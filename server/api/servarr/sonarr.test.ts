import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAX_SERVARR_CONFIGURATION_RESULTS } from './base';
import { sanitizeSonarrLanguageProfiles, sanitizeSonarrSeries } from './sonarr';

describe('Sonarr response normalization', () => {
  it('returns exact bounded series, season, and statistics records', () => {
    const series = sanitizeSonarrSeries({
      id: 7,
      title: 'Series',
      tvdbId: 99,
      monitored: true,
      apiKey: 'provider-secret',
      tags: [1, 'bad', 2],
      seasons: [
        {
          seasonNumber: 1,
          monitored: true,
          providerOnly: true,
          statistics: {
            episodeFileCount: 4,
            totalEpisodeCount: 8,
            providerSecret: 'nested-secret',
          },
        },
      ],
      statistics: { episodeFileCount: 4, totalEpisodeCount: 8 },
    });

    assert.ok(series);
    assert.deepStrictEqual(series.tags, [1, 2]);
    assert.strictEqual(series.seasons[0].statistics?.episodeFileCount, 4);
    assert.ok(!('apiKey' in series));
    assert.ok(!('providerOnly' in series.seasons[0]));
    assert.ok(!('providerSecret' in (series.seasons[0].statistics ?? {})));
  });

  it('rejects unusable series identities and bounds text', () => {
    assert.strictEqual(sanitizeSonarrSeries({ title: 'No ID' }), undefined);
    assert.strictEqual(
      sanitizeSonarrSeries({
        id: -1,
        title: 'x'.repeat(20_000),
        tvdbId: 1,
      })?.title.length,
      10_000
    );
    assert.strictEqual(
      sanitizeSonarrSeries({ id: -1, title: 'Series', tvdbId: 1 })?.id,
      undefined
    );
  });

  it('returns exact bounded language profile records', () => {
    const profiles = sanitizeSonarrLanguageProfiles([
      null,
      { id: 'invalid', name: 'Invalid' },
      ...Array.from(
        { length: MAX_SERVARR_CONFIGURATION_RESULTS + 100 },
        (_, id) => ({
          id,
          name: `Profile ${id}`,
          cutoff: 10,
          items: [{ id: 'provider-only' }],
          apiKey: 'provider-secret',
        })
      ),
    ]);

    assert.strictEqual(profiles.length, MAX_SERVARR_CONFIGURATION_RESULTS - 2);
    assert.deepStrictEqual(profiles[0], { id: 0, name: 'Profile 0' });
  });
});
