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
