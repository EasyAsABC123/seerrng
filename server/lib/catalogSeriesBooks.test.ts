import OpenLibraryAPI from '@server/api/openlibrary';
import { resolveCatalogSeriesBooks } from '@server/lib/catalogSeriesBooks';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, it, mock } from 'node:test';

setupTestDb();
const isbn = '9780140328721';
const otherIsbn = '9780261103573';
const books = (ids = ['hc:1']) =>
  ids.map((foreignBookId) => ({
    foreignBookId,
    title: `Book ${foreignBookId}`,
    authorName: 'Author',
    position: '1',
  }));
beforeEach(() => {
  mock.method(OpenLibraryAPI.prototype, 'getWork', async (id: string) => ({
    key: `/works/${id}`,
    title: 'Verified work',
  }));
  mock.method(OpenLibraryAPI.prototype, 'findWorksByIsbns', async () => []);
});
afterEach(() => mock.restoreAll());

it('resolves an explicit backend work identity without title matching or ISBNs', async () => {
  const result = await resolveCatalogSeriesBooks(books(), {
    getCatalogBookIdentity: async () => ({ workIds: ['OL1W'], isbns: [] }),
  });
  assert.equal(result.books[0].matchStatus, 'matched');
  assert.equal(result.books[0].book?.id, 'OL1W');
  assert.equal(result.books[0].book?.author, 'Author');
});
it('uses only exact ISBN evidence and ignores unrelated search hits', async () => {
  mock.method(OpenLibraryAPI.prototype, 'findWorksByIsbns', async () => [
    { key: '/works/OL1W', title: 'Exact', isbn: [isbn] },
    { key: '/works/OL2W', title: 'Unrelated', isbn: [otherIsbn] },
  ]);
  const result = await resolveCatalogSeriesBooks(books(), {
    getCatalogBookIdentity: async () => ({ workIds: [], isbns: [isbn] }),
  });
  assert.equal(result.books[0].book?.id, 'OL1W');
});
it('blocks explicit work/ISBN conflicts rather than choosing one source', async () => {
  mock.method(OpenLibraryAPI.prototype, 'findWorksByIsbns', async () => [
    { key: '/works/OL2W', title: 'Conflict', isbn: [isbn] },
  ]);
  const result = await resolveCatalogSeriesBooks(books(), {
    getCatalogBookIdentity: async () => ({ workIds: ['OL1W'], isbns: [isbn] }),
  });
  assert.equal(result.books[0].matchStatus, 'ambiguous');
  assert.equal(result.books[0].book, undefined);
});
it('blocks different catalog books claiming one work but allows repeated membership of one catalog book', async () => {
  const client = {
    getCatalogBookIdentity: async () => ({ workIds: ['OL1W'], isbns: [] }),
  };
  assert.deepEqual(
    (
      await resolveCatalogSeriesBooks(books(['hc:1', 'hc:2']), client)
    ).books.map((b) => b.matchStatus),
    ['ambiguous', 'ambiguous']
  );
  assert.deepEqual(
    (
      await resolveCatalogSeriesBooks(books(['hc:1', 'hc:1']), client)
    ).books.map((b) => b.matchStatus),
    ['matched', 'matched']
  );
});
it('retains healthy members when another exact lookup fails', async () => {
  const result = await resolveCatalogSeriesBooks(books(['hc:1', 'hc:2']), {
    getCatalogBookIdentity: async (id) => {
      if (id === 'hc:2') throw new Error('private upstream data');
      return { workIds: ['OL1W'], isbns: [] };
    },
  });
  assert.deepEqual(
    result.books.map((b) => b.matchStatus),
    ['matched', 'unavailable']
  );
  assert(!JSON.stringify(result).includes('private'));
});
it('does not accept a known ID when the remaining ISBN evidence is unavailable', async () => {
  mock.method(OpenLibraryAPI.prototype, 'findWorksByIsbns', async () => {
    throw new Error('outage');
  });
  const result = await resolveCatalogSeriesBooks(books(), {
    getCatalogBookIdentity: async () => ({ workIds: ['OL1W'], isbns: [isbn] }),
  });
  assert.equal(result.books[0].matchStatus, 'unavailable');
  assert.equal(result.books[0].book, undefined);
});
it('leaves absent or invalid evidence unresolved and rejects wrong-work responses', async () => {
  assert.equal(
    (
      await resolveCatalogSeriesBooks(books(), {
        getCatalogBookIdentity: async () => undefined,
      })
    ).books[0].matchStatus,
    'unmatched'
  );
  assert.equal(
    (
      await resolveCatalogSeriesBooks(books(), {
        getCatalogBookIdentity: async () => ({ workIds: ['hc:1'], isbns: [] }),
      })
    ).books[0].matchStatus,
    'unavailable'
  );
  mock.method(OpenLibraryAPI.prototype, 'getWork', async () => ({
    key: '/works/OL99W',
    title: 'Wrong',
  }));
  assert.equal(
    (
      await resolveCatalogSeriesBooks(books(), {
        getCatalogBookIdentity: async () => ({ workIds: ['OL1W'], isbns: [] }),
      })
    ).books[0].matchStatus,
    'unavailable'
  );
});
it('bounds catalog enrichment without hiding the remaining members', async () => {
  let calls = 0;
  const result = await resolveCatalogSeriesBooks(
    books(Array.from({ length: 101 }, (_, i) => `hc:${i + 1}`)),
    {
      getCatalogBookIdentity: async () => {
        calls++;
        return undefined;
      },
    }
  );
  assert.equal(calls, 100);
  assert.equal(result.books.length, 101);
  assert.equal(result.resolutionTruncated, true);
  assert.equal(result.books[100].matchStatus, 'unavailable');
});

it('uses complete identifiers from the series response without the individual metadata service', async () => {
  mock.method(OpenLibraryAPI.prototype, 'findWorksByIsbns', async () => [
    { key: '/works/OL1W', title: 'Exact', isbn: [isbn] },
  ]);
  const result = await resolveCatalogSeriesBooks(
    [{ ...books()[0], isbns: [isbn], identifiersComplete: true }],
    {
      getCatalogBookIdentity: async () => {
        throw new Error(
          'must not call the unavailable individual metadata service'
        );
      },
    }
  );
  assert.equal(result.books[0].book?.id, 'OL1W');
});
it('rejects truncated series identifier evidence rather than matching a subset', async () => {
  const result = await resolveCatalogSeriesBooks(
    [{ ...books()[0], isbns: [isbn], identifiersComplete: false }],
    { getCatalogBookIdentity: async () => ({ workIds: ['OL1W'], isbns: [] }) }
  );
  assert.equal(result.books[0].matchStatus, 'unavailable');
});

it('resolves the Kingkiller novels using ISBN plus full title and author, excluding sets, novellas, and split volumes', async () => {
  const main1 = '9780756404079',
    set = '9781473232280',
    novella = '9788401337208';
  const main2 = '9780756404734',
    split1 = '9783867179614',
    split2 = '9782352946588';
  mock.method(OpenLibraryAPI.prototype, 'findWorksByIsbns', async () => [
    {
      key: '/works/OL8479867W',
      title: 'The Name of the Wind',
      author_name: ['Patrick Rothfuss', 'Marc Simonetti'],
      isbn: [main1, novella],
    },
    {
      key: '/works/OL24343635W',
      title: 'Kingkiller Chronicle Patrick Rothfuss Collection 3 Books Set',
      author_name: ['Patrick Rothfuss'],
      isbn: [set],
    },
    {
      key: '/works/OL17067388W',
      title: 'A Slow Regard of Silent Things',
      author_name: ['Patrick Rothfuss'],
      isbn: [novella],
    },
    {
      key: '/works/OL8479869W',
      title: 'The Wise Man’s Fear',
      author_name: ['Patrick Rothfuss'],
      isbn: [main2],
    },
    {
      key: '/works/OL16817144W',
      title: 'The Wise Man’s Fear [1/2]',
      author_name: ['Patrick Rothfuss'],
      isbn: [split1],
    },
    {
      key: '/works/OL16817145W',
      title: 'The Wise Man’s Fear [2/2]',
      author_name: ['Patrick Rothfuss'],
      isbn: [split2],
    },
  ]);
  const result = await resolveCatalogSeriesBooks(
    [
      {
        foreignBookId: 'hc:379217',
        title: 'The Name of the Wind',
        authorName: 'Patrick Rothfuss',
        isbns: [main1, set, novella],
        identifiersComplete: true,
      },
      {
        foreignBookId: 'hc:381332',
        title: "The Wise Man's Fear",
        authorName: 'Patrick Rothfuss',
        isbns: [main2, split1, split2],
        identifiersComplete: true,
      },
    ],
    { getCatalogBookIdentity: async () => undefined }
  );
  assert.deepEqual(
    result.books.map((b) => b.book?.id),
    ['OL8479867W', 'OL8479869W']
  );
  assert(
    result.books.every(
      (b) =>
        b.matchStatus === 'matched' && b.book?.author === 'Patrick Rothfuss'
    )
  );
});

it('keeps duplicate full titles, absent author evidence, and author disagreement ambiguous', async () => {
  for (const authors of [undefined, ['Different Author'], ['Author']]) {
    mock.method(OpenLibraryAPI.prototype, 'findWorksByIsbns', async () => [
      {
        key: '/works/OL1W',
        title: 'Main Work',
        author_name: authors,
        isbn: [isbn],
      },
      {
        key: '/works/OL2W',
        title: authors?.[0] === 'Author' ? 'Main Work' : 'Main Work [1/2]',
        isbn: [otherIsbn],
      },
    ]);
    const result = await resolveCatalogSeriesBooks(
      [
        {
          foreignBookId: 'hc:1',
          title: 'Main Work',
          authorName: 'Author',
          isbns: [isbn, otherIsbn],
          identifiersComplete: true,
        },
      ],
      { getCatalogBookIdentity: async () => undefined }
    );
    assert.equal(result.books[0].matchStatus, 'ambiguous');
    assert.equal(result.books[0].book, undefined);
  }
});

it('never uses title/author agreement to override explicit work IDs or incomplete evidence', async () => {
  mock.method(OpenLibraryAPI.prototype, 'findWorksByIsbns', async () => [
    {
      key: '/works/OL2W',
      title: 'Main Work',
      author_name: ['Author'],
      isbn: [isbn],
    },
  ]);
  const result = await resolveCatalogSeriesBooks(
    [{ foreignBookId: 'hc:1', title: 'Main Work', authorName: 'Author' }],
    {
      getCatalogBookIdentity: async () => ({
        workIds: ['OL1W'],
        isbns: [isbn],
      }),
    }
  );
  assert.equal(result.books[0].matchStatus, 'ambiguous');
  const incomplete = await resolveCatalogSeriesBooks(
    [
      {
        foreignBookId: 'hc:1',
        title: 'Main Work',
        authorName: 'Author',
        isbns: [isbn],
        identifiersComplete: false,
      },
    ],
    { getCatalogBookIdentity: async () => undefined }
  );
  assert.equal(incomplete.books[0].matchStatus, 'unavailable');
});

it('does not search or request a work based on matching title and author without matching ISBN evidence', async () => {
  mock.method(OpenLibraryAPI.prototype, 'findWorksByIsbns', async () => [
    {
      key: '/works/OL1W',
      title: 'Main Work',
      author_name: ['Author'],
      isbn: [otherIsbn],
    },
  ]);
  const result = await resolveCatalogSeriesBooks(
    [
      {
        foreignBookId: 'hc:1',
        title: 'Main Work',
        authorName: 'Author',
        isbns: [isbn],
        identifiersComplete: true,
      },
    ],
    { getCatalogBookIdentity: async () => undefined }
  );
  assert.equal(result.books[0].matchStatus, 'unmatched');
});
