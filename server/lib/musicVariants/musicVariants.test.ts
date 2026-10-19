import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compareTrackLists, labelEdition } from '@server/lib/musicVariants';

describe('music edition labels', () => {
  it('reads edition markers from the release text', () => {
    assert.equal(labelEdition('Album (Deluxe Edition)').kind, 'deluxe');
    assert.equal(labelEdition('Album', '2011 remaster').kind, 'remaster');
    assert.equal(labelEdition('Album', '20th anniversary').kind, 'anniversary');
    assert.equal(labelEdition('Album').kind, 'other');
  });
});

describe('track comparison', () => {
  it('lists real additions and omissions ignoring case and punctuation', () => {
    const diff = compareTrackLists(
      ['One', 'Two', 'Three!'],
      ['one', 'Two', 'Bonus Track', 'Another Bonus']
    );
    assert.deepEqual(diff.extra, ['Bonus Track', 'Another Bonus']);
    assert.deepEqual(diff.missing, ['Three!']);
  });
});
