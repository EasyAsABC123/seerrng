import { expect, test } from '@playwright/test';
import { restoreAdminPresentation } from './helpers/presentation';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });
test.afterEach(async ({ page }) => restoreAdminPresentation(page));
for (const theme of ['seerrOrig', 'seerrNGJ']) {
  for (const width of [390, 1440]) {
    test(`automatic book requests target both formats ${theme} ${width}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      expect(
        (
          await page.request.post('/api/v1/auth/local', {
            data: { email: 'admin@seerr.dev', password: 'test1234' },
          })
        ).status()
      ).toBe(200);
      await page.request.post('/api/v1/user/1/settings/main', {
        data: { locale: 'en' },
      });
      await page.request.post('/api/v1/user/1/settings/interface-theme', {
        data: { theme },
      });
      await page.route('**/api/v1/settings/public', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        await route.fulfill({
          json: {
            ...body,
            booksEnabled: true,
            ebookServiceEnabled: true,
            audiobookServiceEnabled: true,
            enabledMediaCategories: {
              ...body.enabledMediaCategories,
              ebook: true,
              audiobook: true,
            },
          },
        });
      });
      const services = [
        {
          id: 1,
          name: 'Chaptarr EPUB',
          backend: 'readarr',
          serviceType: 'ebook',
          isDefault: true,
          activeProfileId: 3,
          activeDirectory: '/books',
        },
        {
          id: 2,
          name: 'Chaptarr Audiobooks',
          backend: 'readarr',
          serviceType: 'audiobook',
          isDefault: true,
          activeProfileId: 2,
          activeDirectory: '/books',
        },
      ];
      await page.route('**/api/v1/service/readarr', (route) =>
        route.fulfill({ json: services })
      );
      await page.route(/\/api\/v1\/service\/readarr\/[12]$/, (route) =>
        route.fulfill({
          json: {
            server: services[0],
            profiles: [{ id: 3, name: 'EPUB' }],
            rootFolders: [{ id: 1, path: '/books' }],
            tags: [],
          },
        })
      );
      await page.route('**/api/v1/book/OL999993W*', (route) =>
        route.fulfill({
          json: {
            id: 'OL999993W',
            provider: 'openlibrary',
            mediaType: 'book',
            title: 'Paired format fixture',
            author: 'Fixture Author',
            subjects: [],
            isbnCandidates: [{ isbn: '9781401394226', format: 'audio cd' }],
            mediaInfo: null,
          },
        })
      );
      await page.route('**/api/v1/editions/book?*', (route) =>
        route.fulfill({ json: { editions: [], supportsAlongside: false } })
      );
      await page.goto('/book/OL999993W?request=1');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      if (!process.env.BOOK_ISBN_BASELINE) {
        await expect(
          dialog.getByRole('button', { name: 'Book + Audiobook', exact: true })
        ).toBeVisible();
        await expect(dialog.locator('#isbn')).toHaveCount(0);
      }
      await page.screenshot({
        path: info.outputPath('paired-default.png'),
        fullPage: true,
      });
      expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(width);
      if (!process.env.BOOK_ISBN_BASELINE) {
        await page.route('**/api/v1/request', (route) =>
          route.fulfill({ json: { id: 999993, status: 1 } })
        );
        const sent = page.waitForRequest(
          (r) =>
            r.method() === 'POST' &&
            new URL(r.url()).pathname === '/api/v1/request'
        );
        await dialog
          .getByRole('button', { name: 'Request', exact: true })
          .click();
        const payload = (await sent).postDataJSON();
        expect(payload.format).toBe('both');
        expect(payload.preferredIsbn13).toBeUndefined();
        expect(payload.preferredEditionId).toBeUndefined();
      }
    });
  }
}
