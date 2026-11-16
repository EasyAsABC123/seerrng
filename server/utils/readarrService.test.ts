import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDefaultBookRequestFormat } from './readarrService';

describe('default book request destinations', () => {
  it('requests both formats when both default services are configured', () => {
    assert.equal(
      getDefaultBookRequestFormat([
        { backend: 'readarr', serviceType: 'ebook', isDefault: true },
        { backend: 'readarr', serviceType: 'audiobook', isDefault: true },
      ]),
      'both'
    );
  });
  it('preserves single-format installations and ignores nondefault services', () => {
    assert.equal(
      getDefaultBookRequestFormat([
        { backend: 'readarr', serviceType: 'ebook', isDefault: true },
        { backend: 'readarr', serviceType: 'audiobook', isDefault: false },
      ]),
      'ebook'
    );
    assert.equal(
      getDefaultBookRequestFormat([
        { backend: 'readarr', serviceType: 'audiobook', isDefault: true },
      ]),
      'audiobook'
    );
  });
});
