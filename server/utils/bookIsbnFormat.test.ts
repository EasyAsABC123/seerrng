import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isbnCandidateSupportsFormat } from './bookIsbnFormat';

describe('format-specific ISBN selection', () => {
  it('keeps audio CD ISBNs out of ebook selections', () => {
    const candidate = { isbn: '9781401394226', format: 'audio cd' };
    assert.equal(isbnCandidateSupportsFormat(candidate, 'ebook'), false);
    assert.equal(isbnCandidateSupportsFormat(candidate, 'audiobook'), true);
  });
  it('does not infer an ebook from missing or physical format metadata', () => {
    for (const format of [undefined, '', 'Hardcover', 'Paperback']) {
      const candidate = { isbn: '9780739332115', format };
      assert.equal(isbnCandidateSupportsFormat(candidate, 'ebook'), false);
      assert.equal(isbnCandidateSupportsFormat(candidate, 'audiobook'), false);
    }
  });
  it('recognizes digital text and audio labels without crossing formats', () => {
    for (const format of [
      'Epub',
      'e-book',
      'Kindle',
      'PDF',
      'electronic resource',
    ]) {
      const candidate = { isbn: '9780307497901', format };
      assert.equal(isbnCandidateSupportsFormat(candidate, 'ebook'), true);
      assert.equal(isbnCandidateSupportsFormat(candidate, 'audiobook'), false);
    }
    assert.equal(
      isbnCandidateSupportsFormat(
        { isbn: '9780739332115', format: 'Audio eBook' },
        'ebook'
      ),
      false
    );
  });
});
