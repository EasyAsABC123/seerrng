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

const widths = [320, 360, 375, 390, 768, 1024, 1440, 1920];
const pages = [
  '/discover/movies',
  '/discover/tv',
  '/discover/list/8',
  '/movie/550',
  '/movie/550/cast',
  '/person/287',
  '/games',
  '/settings/services',
  '/settings/network',
  '/requests',
  '/users',
];

for (const path of pages) {
  test(`${path} never scrolls horizontally`, async ({ page, baseURL }) => {
    await loginAsAdmin(page, baseURL);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}

test('poster grids keep full-size posters and two columns on phones', async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL);
  for (const width of [320, 360, 375, 390, 412]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/discover/movies');
    await page.waitForLoadState('networkidle');
    const metrics = await page.evaluate(() => {
      const items = [
        ...document.querySelectorAll('ul.cards-vertical > li'),
      ].map((li) => li.getBoundingClientRect());
      const firstRowTop = Math.round(items[0].top);
      return {
        columns: items.filter((r) => Math.round(r.top) === firstRowTop).length,
        posterWidth: items[0].width,
      };
    });
    expect(metrics.columns, `columns at ${width}px`).toBeGreaterThanOrEqual(2);
    expect(metrics.posterWidth, `poster width at ${width}px`).toBeGreaterThan(
      120
    );
  }
});

test('cast posters never overlap their neighbours', async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/movie/550/cast');
  await page.waitForLoadState('networkidle');
  const overlaps = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('ul.cards-vertical > li')]
      .slice(0, 30)
      .map((li) => li.firstElementChild!.getBoundingClientRect());
    let count = 0;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const w =
          Math.min(rects[i].right, rects[j].right) -
          Math.max(rects[i].left, rects[j].left);
        const h =
          Math.min(rects[i].bottom, rects[j].bottom) -
          Math.max(rects[i].top, rects[j].top);
        if (w > 1 && h > 1) count++;
      }
    return count;
  });
  expect(overlaps).toBe(0);
});
