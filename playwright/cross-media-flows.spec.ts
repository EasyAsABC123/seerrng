import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const loginAsAdmin = async (page: Page, baseURL: string | undefined) => {
  const response = await page
    .context()
    .request.post(`${baseURL}/api/v1/auth/local`, {
      data: { email: 'admin@seerr.dev', password: 'test1234' },
      headers: { 'X-Forwarded-Proto': 'https' },
    });
  expect(response.status()).toBe(200);
  const sid = response
    .headersArray()
    .find((h) => h.name.toLowerCase() === 'set-cookie')
    ?.value.match(/^connect\.sid=([^;]+)/)?.[1];
  await page.context().addCookies([
    {
      name: 'connect.sid',
      value: sid!,
      url: baseURL!,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
};

const candidate = (over: Record<string, unknown> = {}) => ({
  mediaType: 'movie',
  id: '278',
  title: 'The Shawshank Redemption',
  year: 1994,
  score: 0.97,
  confidence: 'high',
  evidence: 'Title match',
  source: 'tmdb',
  href: '/movie/278',
  ...over,
});

test('Share: paste, identify, select, and request', async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL);
  const requests: unknown[] = [];
  await page.route('**/api/v1/resolve', async (route) => {
    await route.fulfill({
      json: {
        groups: [
          {
            input: 'Shawshank',
            inputKind: 'text',
            autoSelected: 0,
            candidates: [candidate()],
          },
          {
            input: 'Dune',
            inputKind: 'text',
            candidates: [
              candidate({
                mediaType: 'book',
                id: 'hc-1',
                title: 'Dune',
                confidence: 'moderate',
                evidence: 'Title match',
              }),
              candidate({
                mediaType: 'book',
                id: 'hc-2',
                title: 'Dune Messiah',
                confidence: 'low',
              }),
            ],
          },
        ],
      },
    });
  });
  await page.route('**/api/v1/request', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: { id: 1 } });
  });
  await page.goto('/share');
  const find = page.getByRole('button', { name: /find matches/i });
  await expect(find).toBeDisabled();
  await page.getByLabel(/links, isbns, or titles/i).fill('Shawshank\nDune');
  await expect(find).toBeEnabled();
  await find.click();
  await expect(
    page.getByRole('heading', { name: /matches|found/i }).first()
  ).toBeFocused();
  await expect(
    page.getByText('The Shawshank Redemption').first()
  ).toBeVisible();
  await expect(page.getByText('Dune Messiah')).toBeVisible();
  await page
    .getByRole('radio', { name: /^Dune\b(?! Messiah)/ })
    .first()
    .check();
  await page
    .getByRole('button', { name: /request/i })
    .last()
    .click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests).toContainEqual({ mediaType: 'movie', mediaId: 278 });
  expect(requests).toContainEqual(
    expect.objectContaining({ mediaType: 'book', mediaId: 'hc-1' })
  );
});

test('Share: an unreadable result is announced, not silent', async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL);
  await page.route('**/api/v1/resolve', (route) =>
    route.fulfill({
      json: {
        groups: [
          {
            input: 'https://x.test/a',
            inputKind: 'url',
            candidates: [],
            note: 'unreadable-link',
          },
        ],
      },
    })
  );
  await page.goto('/share');
  await page.getByLabel(/links, isbns, or titles/i).fill('https://x.test/a');
  await page.getByRole('button', { name: /find matches/i }).click();
  await expect(
    page.locator('[role="alert"], [aria-live]').filter({ hasText: /./ }).first()
  ).toBeVisible();
});

test('Game Finder: filter, search, and save', async ({ page, baseURL }) => {
  await loginAsAdmin(page, baseURL);
  let saved: unknown;
  await page.route('**/api/v1/game-content/discover', async (route) => {
    await route.fulfill({
      json: {
        available: true,
        results: [
          {
            game: {
              id: 'igdb-1',
              igdbId: 1,
              title: 'Test Quest',
              summary: '',
              coverUrl: '',
              releaseDate: '2020-01-01',
              platforms: [],
              platformOptions: [],
              genres: [],
              themes: ['Fantasy'],
            },
            reasons: [{ key: 'theme', values: ['Fantasy'] }],
          },
        ],
        nextCursor: null,
      },
    });
  });
  await page.route('**/api/v1/game-content/saved', async (route) => {
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: 5 } });
    }
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto('/discover/games');
  const search = page.getByRole('button', { name: /find games/i });
  await page.getByRole('checkbox', { name: 'Fantasy' }).first().check();
  await search.click();
  await expect(page.getByText('Test Quest')).toBeVisible();
  const save = page.getByRole('button', { name: 'Save Search' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Name', { exact: true }).fill('Cozy fantasy');
  await save.click();
  await expect.poll(() => saved).toMatchObject({ name: 'Cozy fantasy' });
});
