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

const mediaDetailsPages = [
  ['/movie/550', 'movie'],
  ['/tv/1396', 'tv'],
] as const;

for (const [route, mediaType] of mediaDetailsPages) {
  test(`${mediaType} details keep actions in a responsive sidebar`, async ({
    page,
    baseURL,
  }) => {
    await loginAsAdmin(page, baseURL);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    const layout = page.locator(`[data-detail-layout="${mediaType}"]`);
    await expect(layout).toBeVisible();
    const desktop = await layout.evaluate((node) => {
      const information = node.querySelector(':scope > div');
      const actions = node.querySelector(':scope > aside');
      if (!information || !actions) return null;
      const informationBounds = information.getBoundingClientRect();
      const actionsBounds = actions.getBoundingClientRect();
      return {
        display: getComputedStyle(node).display,
        informationX: informationBounds.x,
        informationY: informationBounds.y,
        actionsX: actionsBounds.x,
        actionsY: actionsBounds.y,
      };
    });
    expect(desktop).not.toBeNull();
    expect(desktop!.display).toBe('grid');
    expect(desktop!.actionsX).toBeGreaterThan(desktop!.informationX);
    expect(Math.abs(desktop!.actionsY - desktop!.informationY)).toBeLessThan(2);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    const mobile = await layout.evaluate((node) => {
      const information = node.querySelector(':scope > div');
      const actions = node.querySelector(':scope > aside');
      if (!information || !actions) return null;
      const informationBounds = information.getBoundingClientRect();
      const actionsBounds = actions.getBoundingClientRect();
      return {
        columns: getComputedStyle(node).gridTemplateColumns,
        informationX: informationBounds.x,
        informationY: informationBounds.y,
        actionsX: actionsBounds.x,
        actionsY: actionsBounds.y,
      };
    });
    expect(mobile).not.toBeNull();
    expect(mobile!.columns.split(' ')).toHaveLength(1);
    expect(mobile!.actionsY).toBeLessThan(mobile!.informationY);
    expect(Math.abs(mobile!.actionsX - mobile!.informationX)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });
}
