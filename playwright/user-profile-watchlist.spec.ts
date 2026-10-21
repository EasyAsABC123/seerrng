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
    .find((header) => header.name.toLowerCase() === 'set-cookie')
    ?.value.match(/^connect\.sid=([^;]+)/)?.[1];
  expect(sid).toBeTruthy();
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

test('profile watchlist requests wait until a user ID is available', async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL);
  const watchlistRequests: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes('/api/v1/user/') && pathname.endsWith('/watchlist')) {
      watchlistRequests.push(pathname);
    }
  });

  for (const route of ['/profile/watchlist', '/profile', '/users/1']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    if (route === '/profile/watchlist') {
      await expect(
        page.getByRole('heading', { name: 'Your Watchlist' })
      ).toBeVisible();
    } else {
      await expect(page.getByText(/User ID:\s*1/)).toBeVisible();
    }
    expect(watchlistRequests).not.toContain('/api/v1/user/undefined/watchlist');
  }

  expect(watchlistRequests).toContain('/api/v1/user/1/watchlist');
});
