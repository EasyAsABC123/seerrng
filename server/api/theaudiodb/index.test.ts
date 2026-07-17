import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { setupTestDb } from '@server/test/db';
import TheAudioDb, { sanitizeTheAudioDbImageUrl } from '.';

setupTestDb();

describe('TheAudioDb batch hydration', () => {
  it('bounds concurrent provider fetches', async () => {
    const api = new TheAudioDb();
    let active = 0;
    let peak = 0;
    Object.assign(api as unknown as Record<string, unknown>, {
      fetchArtistImages: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise<void>((resolve) => setImmediate(resolve));
        active -= 1;
        return { artistThumb: null, artistBackground: null };
      },
    });

    const result = await api.batchGetArtistImages(
      Array.from({ length: 20 }, (_, index) => `artist-${index}`)
    );

    assert.strictEqual(Object.keys(result).length, 20);
    assert.ok(peak <= TheAudioDb.BATCH_FETCH_CONCURRENCY);
    assert.strictEqual(TheAudioDb.BATCH_FETCH_CONCURRENCY, 5);
  });
});

describe('sanitizeTheAudioDbImageUrl', () => {
  it('accepts only bounded HTTPS URLs on TheAudioDB hosts', () => {
    assert.strictEqual(
      sanitizeTheAudioDbImageUrl(
        'https://r2.theaudiodb.com/images/media/artist/thumb/image.jpg#fragment'
      ),
      'https://r2.theaudiodb.com/images/media/artist/thumb/image.jpg'
    );
    assert.strictEqual(
      sanitizeTheAudioDbImageUrl('https://theaudiodb.com.evil.test/image.jpg'),
      null
    );
    assert.strictEqual(
      sanitizeTheAudioDbImageUrl('http://r2.theaudiodb.com/image.jpg'),
      null
    );
    assert.strictEqual(sanitizeTheAudioDbImageUrl({}), null);
    assert.strictEqual(
      sanitizeTheAudioDbImageUrl(
        `https://r2.theaudiodb.com/${'x'.repeat(3000)}`
      ),
      null
    );
  });
});
