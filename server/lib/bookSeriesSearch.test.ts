import type { BookSeriesSearchVariant } from '@server/models/BookSeries';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupBookSeriesResults } from './bookSeriesSearch';

const entry = (
  key: string,
  changes: Partial<BookSeriesSearchVariant> = {}
): BookSeriesSearchVariant => ({
  key,
  title: 'The Kingkiller Chronicle',
  serverName: key,
  format: 'ebook',
  source: 'catalog',
  providerId: 'hc:988',
  href: `/catalog/${key}`,
  bookCount: 3,
  ...changes,
});

describe('series search display grouping', () => {
  it('combines formats by provider identity while retaining each backend route', () => {
    const ebook = entry('ebook');
    const audio = entry('audio', { format: 'audiobook' });
    const grouped = groupBookSeriesResults([ebook, audio]);
    assert.equal(grouped.length, 1);
    assert.deepEqual(grouped[0].variants, [ebook, audio]);
    assert.equal(grouped[0].bookCount, 3);
  });

  it('keeps same-title records from different providers or editions separate', () => {
    assert.equal(
      groupBookSeriesResults([
        entry('main'),
        entry('other', { providerId: 'hc:281660' }),
        entry('split', { providerId: 'hc:304339' }),
        entry('goodreads', { providerId: 'gr:988' }),
      ]).length,
      4
    );
  });

  it('does not merge unqualified native IDs or titles across servers', () => {
    assert.equal(
      groupBookSeriesResults([
        entry('server1', { providerId: '170' }),
        entry('server2', { providerId: '170' }),
        entry('missing1', { providerId: undefined }),
        entry('missing2', { providerId: undefined }),
      ]).length,
      4
    );
  });

  it('prefers a catalog over a library subset only when their provider IDs agree', () => {
    const library = entry('library', { source: 'library', bookCount: 1 });
    const catalog = entry('catalog');
    const [group] = groupBookSeriesResults([library, catalog]);
    assert.equal(group.href, catalog.href);
    assert.equal(group.source, 'catalog');
    assert.equal(group.bookCount, 3);
    assert.deepEqual(group.variants, [library, catalog]);
  });

  it('preserves differing library counts without inventing a combined count', () => {
    const [group] = groupBookSeriesResults([
      entry('ebook', {
        source: 'library',
        providerId: 'gr:45262',
        bookCount: 8,
      }),
      entry('audio', {
        source: 'library',
        providerId: 'gr:45262',
        format: 'audiobook',
        bookCount: 9,
      }),
    ]);
    assert.equal(group.bookCount, undefined);
    assert.deepEqual(
      group.variants?.map((variant) => variant.bookCount),
      [8, 9]
    );
  });
});
