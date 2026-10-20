import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ serviceWorkers: 'block' });

const axeSource = process.env.AXE_CORE_PATH
  ? readFileSync(process.env.AXE_CORE_PATH, 'utf8')
  : undefined;

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

const screens: [string, string][] = [
  ['/share', 'Share & Identify'],
  ['/following', 'Following'],
  ['/franchise/tv/1396', 'Franchise'],
  ['/discover/games', 'Game'],
  ['/discover/vibes', 'Vibes'],
  ['/discover/collectors', 'Collector'],
  ['/discover/patches', 'Patch'],
  ['/', 'Share & Identify'],
  ['/discover/books', 'Share & Identify'],
  ['/discover/music', 'Share & Identify'],
];

for (const [path, heading] of screens) {
  test(`cross-media screen ${path} renders without errors`, async ({
    page,
    baseURL,
  }) => {
    await loginAsAdmin(page, baseURL);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const pageTitle = page.locator('.page-title:visible').first();
    await expect(pageTitle).toHaveCSS('font-size', '36px');
    await expect(pageTitle).toHaveCSS('font-weight', '700');
    await page.screenshot({
      path: `${process.env.SHOT_DIR ?? 'test-results'}/${path.replace(/\W+/g, '_')}.png`,
      fullPage: true,
    });
    await expect(page.locator('body')).toContainText(heading, {
      ignoreCase: true,
    });
    if (axeSource) {
      await page.evaluate(axeSource);
      const result = await page.evaluate(() =>
        (window as any).axe.run(document, {
          runOnly: ['wcag2a', 'wcag2aa'],
        })
      );
      const serious = result.violations
        .filter((v: any) => ['serious', 'critical'].includes(v.impact))
        .map(
          (v: any) =>
            `${v.id}: ${v.nodes
              .slice(0, 3)
              .map((n: any) => n.target.join(' '))
              .join(' | ')}`
        );
      expect(serious, 'axe serious/critical').toEqual([]);
    }
    expect(
      errors.filter((e) => !/favicon|404|Failed to load resource/.test(e))
    ).toEqual([]);
  });
}
