import { expect, test } from '@playwright/test';

test('a rejected transport save clears the previous success message', async ({
  page,
}) => {
  let bootstrapSaves = 0;

  await page.route('**/api/v1/settings/public', async (route) => {
    const response = await route.fetch();
    const settings = await response.json();
    await route.fulfill({
      response,
      json: { ...settings, initialized: false },
    });
  });
  await page.route('**/api/v1/status/tls', (route) =>
    route.fulfill({
      json: {
        mode: 'disabled',
        httpPort: 5055,
        httpsPort: null,
        httpAuthAllowed: true,
        redirectsHttpToHttps: false,
        hosts: [],
        caDownloadAvailable: false,
        configuredMode: 'disabled',
        configuredHttpsPort: null,
        configuredHttpAuthAllowed: true,
        configuredRedirectsHttpToHttps: false,
        environmentOverrides: [],
        pendingRestart: false,
        setupRequired: true,
      },
    })
  );
  await page.route('**/api/v1/status/tls/bootstrap', (route) => {
    bootstrapSaves += 1;
    return route.fulfill({ status: 200, json: { saved: true } });
  });

  await page.goto('/setup');

  const transportForm = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Save transport choice' }),
  });
  const acknowledgement = transportForm.getByRole('checkbox').nth(1);
  const saveButton = transportForm.getByRole('button', {
    name: 'Save transport choice',
  });
  const savedMessage = page.getByText(
    'Transport choice saved. Restart SeerrNG, then open the displayed HTTPS address or continue over HTTP when direct HTTP sign-in is enabled.',
    { exact: true }
  );

  await expect(acknowledgement).toBeChecked();
  await saveButton.click();
  await expect(savedMessage).toBeVisible();
  expect(bootstrapSaves).toBe(1);

  await acknowledgement.uncheck();
  await saveButton.click();
  await expect(savedMessage).toHaveCount(0);
  expect(bootstrapSaves).toBe(1);
});
