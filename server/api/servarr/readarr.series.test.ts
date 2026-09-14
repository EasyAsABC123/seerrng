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
        const freshClient = new ReadarrAPI({
          url: `http://127.0.0.1:${address.port}/library/api/v1`,
          apiKey: 'test-key',
          mediaType: format,
        });
        await freshClient.getSeriesByAuthor(20);
        assert.equal(
          calls.filter((path) => path.startsWith('/library/api/v1/series?'))
            .length,
          1,
          'the second client should reuse the cached native series'
        );
        assert.equal(
          freshClient.getSeriesManagementPath(10),
          appName === 'Chaptarr' ? '/series/10' : undefined,
          'management capabilities must survive a warm-cache read'
        );
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

for (const scenario of [
  'valid',
  'wrong-book',
  'unsupported',
  'outage',
] as const) {
  it(`resolves missing native Chaptarr editions with ${scenario} membership evidence`, async () => {
    const paths: string[] = [];
    const http = createServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost');
      assert.equal(req.method, 'GET');
      assert.equal(url.searchParams.get('apikey'), 'test-key');
      paths.push(url.pathname);
      res.setHeader('content-type', 'application/json');
      if (url.pathname === '/library/api/v1/system/status') {
        res.end(JSON.stringify({ appName: 'Chaptarr', version: '0.9.964' }));
      } else if (url.pathname === '/library/api/v1/config/hardcover') {
        res.end(JSON.stringify({ enabled: true }));
      } else if (url.pathname === '/library/api/v1/book/1') {
        res.end(
          JSON.stringify({
            id: 1,
            title: 'Book',
            authorId: 20,
            mediaType: 'audiobook',
          })
        );
      } else if (url.pathname === '/library/api/v1/edition') {
        assert.equal(url.searchParams.get('bookId'), '1');
        assert.equal(url.searchParams.get('mediaType'), 'audiobook');
        res.statusCode =
          scenario === 'unsupported' ? 404 : scenario === 'outage' ? 401 : 200;
        res.end(
          JSON.stringify([
            {
              bookId: scenario === 'wrong-book' ? 2 : 1,
              isbn13: '9780441172719',
            },
          ])
        );
      } else {
        res.statusCode = 404;
        res.end('{}');
      }
    }).listen(0, '127.0.0.1');
    await once(http, 'listening');
    try {
      const api = new ReadarrAPI({
        url: `http://127.0.0.1:${(http.address() as { port: number }).port}/library/api/v1`,
        apiKey: 'test-key',
        mediaType: 'audiobook',
      });
      assert.equal((await api.getNativeSeriesBook(1)).editions, undefined);
      assert(
        !paths.some((path) => path.endsWith('/edition')),
        'discovery must not fetch edition catalogs'
      );
      if (scenario === 'wrong-book' || scenario === 'outage') {
        await assert.rejects(api.getNativeSeriesBook(1, true), {
          message: 'Book server edition metadata is unavailable.',
        });
      } else {
        const book = await api.getNativeSeriesBook(1, true);
        assert.deepEqual(
          book.editions,
          scenario === 'valid' ? [{ isbn13: '9780441172719' }] : undefined
        );
      }
      assert(paths.includes('/library/api/v1/edition'));
      assert(paths.every((path) => !path.includes('/readarr/')));
    } finally {
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });
}

for (const appName of ['Readarr', 'Bookshelf', 'Chaptarr']) {
  it(`searches ${appName} library series and only uses an advertised catalog dialect`, async () => {
    const paths: string[] = [];
    const http = createServer((req, res) => {
      assert.equal(req.method, 'GET');
      const url = new URL(req.url!, 'http://localhost');
      paths.push(url.pathname);
      assert.equal(url.searchParams.get('apikey'), 'series-key');
      res.setHeader('content-type', 'application/json');
      if (url.pathname.endsWith('/system/status'))
        res.end(JSON.stringify({ appName, version: '1.0.0' }));
      else if (url.pathname.endsWith('/config/hardcover'))
        res.end(JSON.stringify({ enabled: true }));
      else if (url.pathname === '/base/api/v1/author')
        res.end(JSON.stringify([{ id: 20 }, { id: 21 }]));
      else if (url.pathname === '/base/api/v1/series')
        res.end(
          JSON.stringify([
            {
              id: 10,
              title: 'Library series',
              mediaType: 'audiobook',
              links: [{ bookId: 1 }],
            },
          ])
        );
      else if (url.pathname === '/base/api/v1/search') {
        assert.equal(url.searchParams.get('term'), 'Expanse & friends');
        res.end(
          JSON.stringify([
            { book: { title: 'A book' } },
            {
              foreignId: 'hc:12',
              series: {
                foreignSeriesId: 'gr:99',
                title: 'Catalog series',
                workCount: 3,
              },
            },
            {
              foreignId: 'gr:12',
              series: { title: 'Unsupported catalog identity' },
            },
          ])
        );
      } else if (url.pathname === '/base/api/v1/series/lookup') {
        assert.equal(url.searchParams.get('foreignSeriesId'), 'hc:12');
        res.end(
          JSON.stringify({
            foreignSeriesId: 'hc:12',
            title: 'Catalog series',
            workCount: 3,
            books: [
              {
                foreignBookId: 'hc:32',
                title: 'Book',
                position: '1',
                authorName: 'Author',
              },
            ],
          })
        );
      } else {
        res.statusCode = 404;
        res.end('{}');
      }
    }).listen(0, '127.0.0.1');
    await once(http, 'listening');
    try {
      const api = new ReadarrAPI({
        url: `http://127.0.0.1:${(http.address() as { port: number }).port}/base/api/v1`,
        apiKey: 'series-key',
        mediaType: 'audiobook',
      });
      const library = await api.getNativeSeriesLibrary();
      assert.equal(
        library.entries.length,
        1,
        'multi-author series must be deduplicated by native identity'
      );
      assert.equal(library.entries[0].authorId, 20);
      assert.equal(library.supported, true);
      const catalog = await api.searchSeriesCatalog('Expanse & friends');
      if (appName === 'Chaptarr') {
        assert.equal(catalog?.length, 1);
        assert.equal(
          catalog?.[0].providerId,
          'hc:12',
          'search provider identity wins over preferred foreign alias'
        );
        assert.equal(
          (await api.getSeriesCatalogPreview('hc:12'))?.books[0].foreignBookId,
          'hc:32'
        );
      } else {
        assert.equal(catalog, undefined);
        assert(!paths.includes('/base/api/v1/search'));
      }
      await assert.rejects(api.getSeriesCatalogPreview('../12'));
      assert(paths.every((path) => !path.includes('/readarr/')));
    } finally {
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });
}

it('keeps partial native inventories and rejects mismatched catalog previews', async () => {
  const http = createServer((req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    res.setHeader('content-type', 'application/json');
    if (url.pathname.endsWith('/system/status'))
      res.end(JSON.stringify({ appName: 'Chaptarr', version: '1.0.0' }));
    else if (url.pathname.endsWith('/config/hardcover'))
      res.end(JSON.stringify({ enabled: true }));
    else if (url.pathname.endsWith('/author'))
      res.end(JSON.stringify([{ id: 20 }, { id: 21 }]));
    else if (
      url.pathname.endsWith('/series') &&
      url.searchParams.get('authorId') === '20'
    )
      res.end(
        JSON.stringify([{ id: 10, title: 'Series', links: [{ bookId: 1 }] }])
      );
    else if (url.pathname.endsWith('/series/lookup'))
      res.end(
        JSON.stringify({
          foreignSeriesId: 'hc:99',
          title: 'Wrong series',
          workCount: 0,
          books: [],
        })
      );
    else {
      res.statusCode = 503;
      res.end('{}');
    }
  }).listen(0, '127.0.0.1');
  await once(http, 'listening');
  try {
    const api = new ReadarrAPI({
      url: `http://127.0.0.1:${(http.address() as { port: number }).port}/api/v1`,
      apiKey: 'key',
      mediaType: 'ebook',
    });
    const library = await api.getNativeSeriesLibrary();
    assert.equal(library.partial, true);
    assert.equal(library.entries.length, 1);
    await assert.rejects(api.getSeriesCatalogPreview('hc:12'));
  } finally {
    http.closeAllConnections();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
});

for (const scenario of [
  'exact',
  'alias',
  'wrong-book',
  'wrong-format',
  'missing',
] as const) {
  it(`checks native catalog identity (${scenario}) before exposing ISBN evidence`, async () => {
    const http = createServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost');
      assert.equal(req.method, 'GET');
      res.setHeader('content-type', 'application/json');
      if (url.pathname.endsWith('/system/status'))
        res.end(JSON.stringify({ appName: 'Chaptarr', version: '1' }));
      else if (url.pathname.endsWith('/config/hardcover'))
        res.end(JSON.stringify({ enabled: true }));
      else {
        assert.equal(url.pathname, '/base/api/v1/book/lookup');
        assert.equal(url.searchParams.get('term'), 'hc:123');
        assert.equal(url.searchParams.get('mediaType'), 'audiobook');
        res.end(
          JSON.stringify(
            scenario === 'missing'
              ? []
              : [
                  {
                    foreignBookId: scenario === 'exact' ? 'hc:123' : 'gr:456',
                    hardcoverBookId:
                      scenario === 'wrong-book' ? 'hc:999' : 'hc:123',
                    openLibraryWorkId: 'ol:OL1W',
                    mediaType:
                      scenario === 'wrong-format' ? 'ebook' : 'audiobook',
                    editions: [{ isbn13: '9780140328721' }],
                  },
                ]
          )
        );
      }
    }).listen(0, '127.0.0.1');
    await once(http, 'listening');
    try {
      const api = new ReadarrAPI({
        url: `http://127.0.0.1:${(http.address() as { port: number }).port}/base/api/v1`,
        apiKey: 'test',
        mediaType: 'audiobook',
      });
      if (scenario === 'wrong-book' || scenario === 'wrong-format')
        await assert.rejects(api.getCatalogBookIdentity('hc:123'));
      else
        assert.deepEqual(
          await api.getCatalogBookIdentity('hc:123'),
          scenario === 'missing'
            ? undefined
            : { workIds: ['OL1W'], isbns: ['9780140328721'] }
        );
    } finally {
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });
}
