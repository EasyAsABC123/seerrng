import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const sceneId = '8a3c0000-0000-4000-8000-000000000001';
const imageFixture =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p6cAAAAASUVORK5CYII=';

const loginAsAdmin = async (page: Page, baseURL: string | undefined) => {
  expect(baseURL).toBeTruthy();
  const loginResponse = await page
    .context()
    .request.post(`${baseURL}/api/v1/auth/local`, {
      data: { email: 'admin@seerr.dev', password: 'test1234' },
      headers: { 'X-Forwarded-Proto': 'https' },
    });
  expect(loginResponse.status()).toBe(200);

  const sessionCookie = loginResponse
    .headersArray()
    .find(
      (header) =>
        header.name.toLowerCase() === 'set-cookie' &&
        header.value.startsWith('connect.sid=')
    )
    ?.value.match(/^connect\.sid=([^;]+)/)?.[1];
  expect(sessionCookie).toBeTruthy();

  await page.context().addCookies([
    {
      name: 'connect.sid',
      value: sessionCookie!,
      url: baseURL!,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  const userResponse = await page
    .context()
    .request.get(`${baseURL}/api/v1/auth/me`);
  expect(userResponse.status()).toBe(200);
  return (await userResponse.json()) as { id: number };
};

const enableAdultForBrowser = async (page: Page) => {
  await page.route('**/api/v1/settings/public', async (route) => {
    const response = await route.fetch();
    const settings = await response.json();
    await route.fulfill({
      response,
      json: {
        ...settings,
        adultEnabled: true,
        enabledMediaCategories: {
          ...settings.enabledMediaCategories,
          adult: true,
        },
      },
    });
  });
};

const makeScene = (serviceId: number, serviceName: string, status = 1) => ({
  id: sceneId,
  provider: 'whisparr',
  mediaType: 'adult',
  title: 'Night Garden',
  year: 2025,
  overview: 'A quiet garden scene.',
  studio: 'Orchard House',
  performers: ['Maya Star', 'River Lane'],
  posterPath: `/api/v1/adult/${sceneId}/cover?serverId=${serviceId}`,
  serviceId,
  serviceName,
  mediaInfo: { id: 42, status, serviceId },
});

const installCatalogRoutes = async (page: Page, userId: number) => {
  const queries: string[] = [];
  const defaultScene = makeScene(3, 'Whisparr Main');

  await page.route('**/api/v1/adult/search*', async (route) => {
    const url = new URL(route.request().url());
    queries.push(url.searchParams.get('query') ?? '');
    await route.fulfill({
      json: {
        page: 1,
        totalPages: 1,
        totalResults: 1,
        results: [defaultScene],
      },
    });
  });
  await page.route(
    (url) => url.pathname.endsWith(`/adult/${sceneId}/cover`),
    (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(imageFixture, 'base64'),
      })
  );
  await page.route(
    (url) => url.pathname === `/api/v1/adult/${sceneId}`,
    async (route) => {
      const serviceId = Number(
        new URL(route.request().url()).searchParams.get('serverId') ?? 3
      );
      await route.fulfill({
        json: makeScene(
          serviceId,
          serviceId === 4 ? 'Whisparr Archive' : 'Whisparr Main'
        ),
      });
    }
  );
  await page.route('**/api/v1/service/whisparr', (route) =>
    route.fulfill({
      json: [
        { id: 3, name: 'Whisparr Main', isDefault: true },
        { id: 4, name: 'Whisparr Archive', isDefault: false },
      ],
    })
  );
  await page.route(`**/api/v1/user/${userId}/quota`, (route) =>
    route.fulfill({ json: { adult: { limit: 0, restricted: false } } })
  );

  return { queries };
};

test('Adult discovery searches, opens scene details, and keeps the chosen Whisparr destination', async ({
  page,
  baseURL,
}) => {
  const user = await loginAsAdmin(page, baseURL);
  await enableAdultForBrowser(page);
  const { queries } = await installCatalogRoutes(page, user.id);
  let requestBody: unknown;
  await page.route('**/api/v1/request', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { id: 91, status: 1 },
    });
  });

  await page.goto('/discover/adult');
  await expect(
    page.getByRole('heading', { name: 'Recently added scenes' })
  ).toBeVisible();
  const card = page.locator(`a[href^="/adult/${sceneId}"]`);
  await expect(card).toContainText('Night Garden');
  await expect(card.getByAltText('Night Garden')).toHaveAttribute(
    'src',
    new RegExp(`/adult/${sceneId}/cover`)
  );

  const search = page.getByRole('searchbox', { name: 'Search adult scenes' });
  await search.fill('Orchard House');
  const searchRequest = page.waitForRequest((request) => {
    if (!request.url().includes('/api/v1/adult/search')) return false;
    return new URL(request.url()).searchParams.get('query') === 'Orchard House';
  });
  await search.press('Enter');
  await searchRequest;
  await expect
    .poll(() => new URL(page.url()).searchParams.get('query'))
    .toBe('Orchard House');
  await expect(
    page.getByRole('heading', { name: 'Search results' })
  ).toBeVisible();
  expect(queries).toContain('Orchard House');

  await page.locator(`a[href^="/adult/${sceneId}"]`).click();
  await expect(
    page.getByRole('heading', { name: 'Night Garden' }).first()
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Search scenes with Maya Star' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Request scene' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const alternateDetailsRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === `/api/v1/adult/${sceneId}` &&
      url.searchParams.get('serverId') === '4'
    );
  });
  await page.locator('select').selectOption('4');
  await alternateDetailsRequest;
  await expect(
    dialog.getByRole('definition').filter({ hasText: 'Whisparr Archive' })
  ).toBeVisible();
  const createRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/v1/request') && request.method() === 'POST'
  );
  await dialog.getByRole('button', { name: 'Request scene' }).click();
  await createRequest;
  expect(requestBody).toEqual({
    mediaId: sceneId,
    mediaType: 'adult',
    serverId: 4,
  });
});

test('Adult request dialog blocks scenes already available at the selected destination', async ({
  page,
  baseURL,
}) => {
  const user = await loginAsAdmin(page, baseURL);
  await enableAdultForBrowser(page);
  await installCatalogRoutes(page, user.id);
  await page.route(
    (url) =>
      url.pathname === `/api/v1/adult/${sceneId}` &&
      new URL(url.href).searchParams.get('serverId') === '4',
    async (route) =>
      route.fulfill({ json: makeScene(4, 'Whisparr Archive', 5) })
  );

  await page.goto(`/adult/${sceneId}?serverId=3`);
  await expect(
    page.getByRole('heading', { name: 'Night Garden' }).first()
  ).toBeVisible();
  await page.getByRole('button', { name: 'Request scene' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.locator('select').selectOption('4');
  await expect(
    dialog.getByText('This scene is already available on this server.')
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Request scene' })
  ).toBeDisabled();
});

test('Adult details can manage and cancel the signed-in user’s active request', async ({
  page,
  baseURL,
}) => {
  const user = await loginAsAdmin(page, baseURL);
  await enableAdultForBrowser(page);
  await installCatalogRoutes(page, user.id);
  await page.route(
    (url) => url.pathname === `/api/v1/adult/${sceneId}`,
    (route) =>
      route.fulfill({
        json: {
          ...makeScene(3, 'Whisparr Main', 3),
          mediaInfo: {
            id: 42,
            status: 3,
            serviceId: 3,
            requestStatus: 2,
            requestId: 92,
          },
        },
      })
  );
  let deletedRequestId: string | undefined;
  await page.route('**/api/v1/request/92', async (route) => {
    if (route.request().method() === 'DELETE') {
      deletedRequestId = route.request().url().split('/').pop();
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });

  await page.goto(`/adult/${sceneId}?serverId=3`);
  await expect(
    page.getByRole('button', { name: 'Manage your request' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Manage your request' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText(
      'Your adult scene request was approved and is being processed.'
    )
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel request' }).click();
  await expect.poll(() => deletedRequestId).toBe('92');
});
