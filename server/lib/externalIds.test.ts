import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_MUSICBRAINZ_BATCH_IDS,
  prepareMusicBrainzBatchIds,
} from './externalIds';

describe('prepareMusicBrainzBatchIds', () => {
  it('normalizes, deduplicates, validates, and caps SQL-bound IDs', () => {
    const ids = prepareMusicBrainzBatchIds([
      ' ABC ',
      'abc',
      123,
      'x'.repeat(129),
      '../search',
      'album?redirect=/account',
      ...Array.from(
        { length: MAX_MUSICBRAINZ_BATCH_IDS + 10 },
        (_, index) => `id-${index}`
      ),
    ]);

    assert.strictEqual(ids[0], 'abc');
    assert.ok(!ids.includes('../search'));
    assert.strictEqual(ids.length, MAX_MUSICBRAINZ_BATCH_IDS);
    assert.deepStrictEqual(prepareMusicBrainzBatchIds({}), []);
  });
});
