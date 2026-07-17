import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeRadarrMovie } from './radarr';

describe('Radarr response normalization', () => {
  it('returns an exact bounded movie and nested media record', () => {
    const movie = sanitizeRadarrMovie({
      id: 9,
      title: 'Movie',
      tmdbId: 42,
      monitored: true,
      hasFile: true,
      tags: [1, 'bad', 2],
      apiKey: 'provider-secret',
      movieFile: {
        id: 3,
        movieId: 9,
        size: 100,
        dateAdded: '2026-01-01',
        qualityCutoffNotMet: false,
        providerSecret: 'nested-secret',
        mediaInfo: {
          resolution: '3840x2160',
          providerOnly: true,
        },
      },
    });

    assert.ok(movie);
    assert.strictEqual(movie.movieFile?.mediaInfo.resolution, '3840x2160');
    assert.deepStrictEqual(movie.tags, [1, 2]);
    assert.ok(!('apiKey' in movie));
    assert.ok(!('providerSecret' in (movie.movieFile ?? {})));
    assert.ok(!('providerOnly' in (movie.movieFile?.mediaInfo ?? {})));
  });

  it('rejects unusable identities and bounds provider text', () => {
    assert.strictEqual(sanitizeRadarrMovie({ title: 'Missing ID' }), undefined);
    const movie = sanitizeRadarrMovie({
      id: -1,
      title: 'x'.repeat(20_000),
      tmdbId: 1,
    });
    assert.strictEqual(movie?.title.length, 10_000);
    assert.strictEqual(movie?.id, 0);
  });
});
