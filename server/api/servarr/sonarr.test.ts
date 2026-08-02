import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { AxiosInstance } from 'axios';

import { MAX_SERVARR_CONFIGURATION_RESULTS } from './base';
import SonarrAPI, {
  sanitizeSonarrLanguageProfiles,
  sanitizeSonarrSeries,
} from './sonarr';

function buildSonarr(): SonarrAPI {
  return new SonarrAPI({ url: 'http://localhost:8989/api/v3', apiKey: 'test' });
}

function getAxios(sonarr: SonarrAPI): AxiosInstance {
  return (sonarr as unknown as { axios: AxiosInstance }).axios;
}

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

describe('SonarrAPI removeSeries', () => {
  afterEach(() => mock.restoreAll());

  it('removes the series when it exists in the library', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await sonarr.removeSeries(1234);

    assert.strictEqual(del.mock.callCount(), 1);
    assert.strictEqual(del.mock.calls[0].arguments[0], '/series/9');
  });

  it('does nothing when the series is not in the library', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({
      data: [{ id: 0, title: 'Breaking Bad', tvdbId: 1234 }],
    }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.doesNotReject(() => sonarr.removeSeries(1234));
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('rejects when the tvdbId is unknown to the lookup', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({ data: [] }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.rejects(() => sonarr.removeSeries(1234), /Series not found/);
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('ignores a 404 when the series was already removed in Sonarr', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    mock.method(getAxios(sonarr), 'delete', async () => {
      throw { response: { status: 404 } };
    });

    await assert.doesNotReject(() => sonarr.removeSeries(1234));
  });

  it('rethrows errors other than 404', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    mock.method(getAxios(sonarr), 'delete', async () => {
      throw { response: { status: 500 } };
    });

    await assert.rejects(() => sonarr.removeSeries(1234));
  });

  it('rethrows a 404 from the lookup instead of treating it as removed', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => {
      throw { response: { status: 404 } };
    });
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.rejects(
      () => sonarr.removeSeries(1234),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 404
    );
    assert.strictEqual(del.mock.callCount(), 0);
  });
});

describe('SonarrAPI getSeriesByTvdbId', () => {
  afterEach(() => mock.restoreAll());

  it('rethrows a 401 from the lookup with the status intact', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => {
      throw { response: { status: 401 } };
    });

    await assert.rejects(
      () => sonarr.getSeriesByTvdbId(1234),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 401
    );
  });

  it('throws "Series not found" when the lookup returns no results', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({ data: [] }));

    await assert.rejects(() => sonarr.getSeriesByTvdbId(1234), {
      message: 'Series not found',
    });
  });
});
