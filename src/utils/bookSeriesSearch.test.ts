import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookSeriesSearchUrl } from './bookSeriesSearch';

describe('series search URLs shared by discovery and direct search', () => {
  it('preserves multi-word names and literal reserved characters without form-encoded spaces', () => {
    const url = bookSeriesSearchUrl(
      ' The Kingkiller Chronicle + A&B? ',
      'audiobook'
    );
    assert.equal(
      url,
      '/api/v1/book-series/search?query=The%20Kingkiller%20Chronicle%20%2B%20A%26B%3F&format=audiobook'
    );
    assert.equal(
      new URL(url!, 'http://localhost').searchParams.get('query'),
      'The Kingkiller Chronicle + A&B?'
    );
  });
  it('omits format for all books and retains explicit book format', () => {
    assert.equal(
      bookSeriesSearchUrl('Kingkiller'),
      '/api/v1/book-series/search?query=Kingkiller'
    );
    assert.equal(
      bookSeriesSearchUrl('Kingkiller', 'ebook'),
      '/api/v1/book-series/search?query=Kingkiller&format=ebook'
    );
  });
  it('does not request empty, short, or overlong names', () => {
    for (const query of ['', ' ', ' a ', 'x'.repeat(201)])
      assert.equal(bookSeriesSearchUrl(query), null);
    assert.ok(bookSeriesSearchUrl('x'.repeat(200)));
  });
});
