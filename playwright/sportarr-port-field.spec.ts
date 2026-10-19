import { expect, test } from '@playwright/test';

test('Sportarr Port remains readable while configuring a connection', async ({
  page,
  baseURL,
}) => {
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

  await page.goto('/settings/services');
  await page.getByRole('button', { name: 'Connect Sportarr Server' }).click();

  const dialog = page.getByRole('dialog');
  const port = dialog.getByRole('spinbutton', { name: 'Port*' });
  await port.fill('1867');
  await expect(port).toHaveValue('1867');
  const colors = await port.evaluate((element) => {
    const style = getComputedStyle(element);
    const themeControlText = style
      .getPropertyValue('--theme-control-text')
      .trim()
      .split(/\s+/)
      .join(', ');
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      expectedTextColor: `rgb(${themeControlText})`,
    };
  });
  expect(colors.color).toBe(colors.expectedTextColor);
  expect(colors.backgroundColor).not.toBe('rgb(255, 255, 255)');
  await page.screenshot({
    path: '/tmp/seerrng-sportarr-port-desktop.png',
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(port).toBeVisible();
  await page.screenshot({
    path: '/tmp/seerrng-sportarr-port-narrow.png',
    fullPage: true,
  });
});
