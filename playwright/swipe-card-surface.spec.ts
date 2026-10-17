import { expect, test } from '@playwright/test';

test('Swipe card details have an opaque surface above the stacked cards', async ({
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

  await page.route('**/api/v1/swipe/status', (route) =>
    route.fulfill({
      json: {
        aiRanking: false,
        mediaTypes: ['movie'],
        bookFormats: ['ebook', 'audiobook'],
      },
    })
  );
  await page.route('**/api/v1/swipe/decisions*', (route) =>
    route.fulfill({ json: { decisions: [] } })
  );
  await page.route('**/api/v1/swipe/profile', (route) =>
    route.fulfill({
      json: {
        tasteNotes: '',
        seriesRequest: 'first-season',
        bookFormat: 'ebook',
        seedScope: 'full',
        favoriteSeeds: [],
      },
    })
  );
  await page.route('**/api/v1/swipe/deck*', (route) =>
    route.fulfill({
      json: {
        mediaType: 'movie',
        ranked: false,
        remaining: 3,
        cards: [
          {
            mediaType: 'movie',
            id: '101',
            title: 'Top Card With Long Details',
            tags: [],
            subtitle: 'Top card subtitle',
            overview:
              'The top card details occupy the panel while stacked cards remain behind this text.',
          },
          {
            mediaType: 'movie',
            id: '102',
            title: 'Second Stacked Card',
            tags: [],
            subtitle: 'Second card subtitle',
            overview: 'Text from the card behind the top panel.',
          },
          {
            mediaType: 'movie',
            id: '103',
            title: 'Third Stacked Card',
            tags: [],
            overview: 'Additional background card text.',
          },
        ],
      },
    })
  );

  await page.goto('/swipe');
  const body = page.locator(
    '.swipe-card[data-stack-position="0"] .swipe-card-body'
  );
  await expect(body).toBeVisible();
  const background = await body.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );
  await page.screenshot({
    path: '/tmp/seerrng-issue-191-after-desktop.png',
    fullPage: true,
  });
  expect(background).not.toBe('rgba(0, 0, 0, 0)');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(body).toBeVisible();
  await expect
    .poll(() =>
      body.evaluate((element) => getComputedStyle(element).backgroundColor)
    )
    .not.toBe('rgba(0, 0, 0, 0)');
  await page.screenshot({
    path: '/tmp/seerrng-issue-191-after-narrow.png',
    fullPage: true,
  });
});
