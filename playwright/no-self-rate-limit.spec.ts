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

// Every slider and list used to POST its own cache-warm request, so one ordinary
// Discover load exceeded the per-client limit and answered 429 to ourselves.
for (const path of ['/', '/discover/movies', '/discover/tv']) {
  test(`${path} does not rate-limit its own image requests`, async ({
    page,
    baseURL,
  }) => {
    await loginAsAdmin(page, baseURL);
    const warmCalls: string[] = [];
    const limited: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/imageproxy/warm'))
        warmCalls.push(request.url());
    });
    page.on('response', (response) => {
      if (response.status() === 429) limited.push(response.url());
    });

    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // Scroll through the page so lazy shelves mount and queue their warm requests.
    for (let y = 0; y < 6000; y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(6000);

    expect(limited, 'no response should be rate limited').toEqual([]);
    // One shared queue spaces batches at least 4s apart: at most ~1 per 4s.
    expect(warmCalls.length).toBeLessThanOrEqual(6);
  });
}
