import ReadarrAPI from '@server/api/servarr/readarr';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { it } from 'node:test';

for (const appName of ['Readarr', 'Bookshelf', 'Chaptarr']) {
  for (const format of ['ebook', 'audiobook'] as const) {
    it(`reads native ${appName} ${format} series resources behind a URL base with read-only requests`, async () => {
      const calls: string[] = [];
      const http = createServer((req, res) => {
        assert.equal(req.method, 'GET');
        const url = new URL(req.url!, 'http://localhost');
        assert.equal(url.searchParams.get('apikey'), 'test-key');
        calls.push(req.url!);
        res.setHeader('content-type', 'application/json');
        if (url.pathname === '/library/api/v1/system/status') {
          res.end(
            JSON.stringify({ appName, version: '1.0.0', urlBase: '/library' })
          );
        } else if (url.pathname === '/library/api/v1/config/hardcover') {
          res.end(JSON.stringify({ enabled: true }));
        } else if (req.url!.startsWith('/library/api/v1/series?')) {
          const query = new URL(req.url!, 'http://localhost').searchParams;
          assert.equal(query.get('authorId'), '20');
          assert.equal(query.get('mediaType'), format);
          res.end(
            JSON.stringify([
              {
                id: 10,
                title: 'Series',
                mediaType: format,
                links: [{ bookId: 1, position: '1.5' }],
              },
              {
                id: 11,
                title: 'Other format',
                mediaType: format === 'ebook' ? 'audiobook' : 'ebook',
                links: [],
              },
            ])
          );
        } else if (url.pathname === '/library/api/v1/book/1') {
          res.end(
            JSON.stringify({
              id: 1,
              title: 'Book',
              authorId: 20,
              mediaType: format,
              editions: [{ isbn13: null }],
            })
          );
        } else {
          res.statusCode = 404;
          res.end('{}');
        }
      }).listen(0, '127.0.0.1');
      await once(http, 'listening');
      try {
        const address = http.address() as { port: number };
        const api = new ReadarrAPI({
          url: `http://127.0.0.1:${address.port}/library/api/v1`,
          apiKey: 'test-key',
          mediaType: format,
        });
        assert.equal((await api.getNativeSeriesBook(1)).id, 1);
        const series = await api.getSeriesByAuthor(20);
        assert.equal(series?.length, 1);
        assert.equal(series?.[0].links[0].position, '1.5');
        assert.equal(calls.length, appName === 'Chaptarr' ? 4 : 3);
        assert.equal(
          api.getSeriesManagementPath(10),
          appName === 'Chaptarr' ? '/series/10' : undefined
        );
        assert(calls.every((path) => !path.includes('facade')));
      } finally {
        http.closeAllConnections();
        await new Promise<void>((resolve) => http.close(() => resolve()));
      }
    });
  }
}
for (const status of [404, 405, 501, 401, 503, 200]) {
  it(`handles series HTTP ${status} without confusing an outage or malformed response with no series`, async () => {
    const http = createServer((_req, res) => {
      if (_req.url?.includes('/system/status')) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ appName: 'Readarr', version: '1.0.0' }));
        return;
      }
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ unexpected: 'secret' }));
    }).listen(0, '127.0.0.1');
    await once(http, 'listening');
    try {
      const address = http.address() as { port: number };
      const api = new ReadarrAPI({
        url: `http://127.0.0.1:${address.port}/api/v1`,
        apiKey: 'key',
        mediaType: 'ebook',
      });
      if ([404, 405, 501].includes(status))
        assert.equal(await api.getSeriesByAuthor(20), undefined);
      else
        await assert.rejects(api.getSeriesByAuthor(20), {
          message: 'Book server series metadata is unavailable.',
        });
      await assert.rejects(api.getNativeSeriesBook(-1), {
        message: 'Invalid book ID.',
      });
    } finally {
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });
}
