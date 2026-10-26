import { expect, test } from '@playwright/test';

test('Sonarr v5 defaults persist and remain readable at desktop and narrow widths', async ({
  page,
  baseURL,
}) => {
  const login = await page
    .context()
    .request.post(`${baseURL}/api/v1/auth/local`, {
      data: { email: 'admin@seerr.dev', password: 'test1234' },
      headers: { 'X-Forwarded-Proto': 'https' },
    });
  expect(login.status()).toBe(200);
  const session = login
    .headersArray()
    .find(
      (h) =>
        h.name.toLowerCase() === 'set-cookie' &&
        h.value.startsWith('connect.sid=')
    )
    ?.value.match(/^connect\.sid=([^;]+)/)?.[1];
  expect(session).toBeTruthy();
  await page.context().addCookies([
    {
      name: 'connect.sid',
      value: session!,
      url: baseURL!,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  let legacySonarr = false;
  await page.route('**/api/v1/settings/sonarr/test', (route) =>
    route.fulfill({
      json: {
        profiles: [{ id: 7, name: '1080p or better' }],
        rootFolders: [{ id: 1, path: '/mnt/TV Shows' }],
        tags: [],
        languageProfiles: legacySonarr ? [{ id: 1, name: 'English' }] : null,
        metadataLanguages: legacySonarr
          ? null
          : [
              { id: 1, name: 'English' },
              { id: 2, name: 'French' },
            ],
      },
    })
  );
  // Connection responses are mocked; saves use only the disposable E2E config.
  await page.route('**/api/v1/settings/sonarr', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] });
    return route.continue();
  });
  await page.goto('/settings/services');
  await page
    .getByRole('button', { name: 'Add Sonarr Server', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Server Name', { exact: false })
    .fill('Sonarr default test');
  await dialog
    .getByLabel('Hostname or IP Address', { exact: false })
    .fill('sonarr.example');
  await dialog
    .getByLabel('API Key', { exact: false })
    .fill('playwright-test-key');
  await dialog.getByRole('button', { name: 'Test', exact: true }).click();
  await dialog
    .getByLabel('Quality Profile', { exact: false })
    .first()
    .selectOption('7');
  await dialog
    .getByLabel('Root Folder', { exact: false })
    .first()
    .selectOption('/mnt/TV Shows');
  const baseline = process.env.SEERR_SONARR_BASELINE === 'true';
  const evidence = baseline ? 'baseline' : 'candidate';
  if (!baseline) {
    await expect(
      dialog.getByLabel('Default Metadata Language', { exact: true })
    ).toHaveValue('');
    await expect(
      dialog.getByLabel('Default Season Order', { exact: true })
    ).toHaveValue('official');
  }
  for (const viewport of [
    { width: 1280, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    if (!baseline) {
      const language = dialog.getByLabel('Default Metadata Language', {
        exact: true,
      });
      await language.scrollIntoViewIfNeeded();
      await expect(language).toBeVisible();
      const box = await language.boundingBox();
      const bounds = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        bounds!.x + bounds!.width + 1
      );
    }
    await page.screenshot({
      path: `/tmp/seerr-sonarr-${evidence}-${viewport.width}.png`,
      fullPage: true,
    });
  }
  if (baseline) return;
  await page.setViewportSize({ width: 1280, height: 1000 });
  await dialog
    .getByLabel('Default Metadata Language', { exact: true })
    .selectOption('2');
  await dialog
    .getByLabel('Default Season Order', { exact: true })
    .selectOption('automatic');
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/v1/settings/sonarr')
  );
  await dialog.getByRole('button', { name: 'Add Server', exact: true }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(201);
  const settings = await response.json();
  expect(settings.defaultMetadataLanguageId).toBe(2);
  expect(settings.defaultSeasonType).toBe('automatic');
  const persisted = await page
    .context()
    .request.get(`${baseURL}/api/v1/settings/sonarr`);
  expect(
    (await persisted.json()).find(
      (server: { id: number }) => server.id === settings.id
    )
  ).toMatchObject({
    defaultMetadataLanguageId: 2,
    defaultSeasonType: 'automatic',
  });
  await expect(dialog).toBeHidden();
  await page.unroute('**/api/v1/settings/sonarr');
  await page.reload();
  const card = page
    .locator('.settings-service-card')
    .filter({ hasText: 'Sonarr default test' })
    .last();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(
    dialog.getByLabel('Default Metadata Language', { exact: true })
  ).toHaveValue('2');
  await expect(
    dialog.getByLabel('Default Season Order', { exact: true })
  ).toHaveValue('automatic');
  await dialog
    .getByLabel('Default Metadata Language', { exact: true })
    .selectOption('');
  await dialog
    .getByLabel('Default Season Order', { exact: true })
    .selectOption('official');
  const updated = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().endsWith(`/api/v1/settings/sonarr/${settings.id}`)
  );
  await dialog
    .getByRole('button', { name: 'Save Changes', exact: true })
    .click();
  const update = await updated;
  expect(update.status(), await update.text()).toBe(200);
  expect(await update.json()).toMatchObject({ defaultSeasonType: 'official' });
  expect((await update.json()).defaultMetadataLanguageId).toBeUndefined();
  await expect(dialog).toBeHidden();
  legacySonarr = true;
  await page
    .getByRole('button', { name: 'Add Sonarr Server', exact: true })
    .click();
  await dialog
    .getByLabel('Hostname or IP Address', { exact: false })
    .fill('legacy-sonarr.example');
  await dialog
    .getByLabel('API Key', { exact: false })
    .fill('playwright-test-key');
  await dialog.getByRole('button', { name: 'Test', exact: true }).click();
  await expect(
    dialog.getByLabel('Language Profile', { exact: false }).first()
  ).toBeVisible();
  await expect(
    dialog.getByLabel('Default Metadata Language', { exact: true })
  ).toHaveCount(0);
  await expect(
    dialog.getByLabel('Default Season Order', { exact: true })
  ).toHaveCount(0);
});
