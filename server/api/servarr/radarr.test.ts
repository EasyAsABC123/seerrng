import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { RadarrMovie } from '@server/api/servarr/radarr';
import RadarrAPI from '@server/api/servarr/radarr';

const movie = (overrides: Partial<RadarrMovie> = {}): RadarrMovie => ({
  id: 42,
  title: 'Test Movie',
  isAvailable: true,
  monitored: true,
  tmdbId: 100,
  imdbId: 'tt0000100',
  titleSlug: 'test-movie',
  folderName: 'Test Movie',
  path: '/movies/Test Movie',
  profileId: 1,
  qualityProfileId: 1,
  added: '2026-01-01T00:00:00Z',
  hasFile: true,
  tags: [],
  ...overrides,
});

describe('RadarrAPI.getMovieCover', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('fetches the first advertised relative cover path outside the API base path', async () => {
    const api = new RadarrAPI({
      url: 'http://localhost:7878/base/api/v3',
      apiKey: 'key',
    });
    mock.method(api, 'getMovie', async () =>
      movie({
        images: [
          {
            coverType: 'poster',
            url: '/MediaCover/42/poster.jpg',
          },
        ],
      })
    );
    const axiosGetMock = mock.fn(async () => ({
      data: Buffer.from('movie-image'),
      headers: { 'content-type': 'image/jpeg' },
    }));
    (
      api as unknown as {
        axios: { get: typeof axiosGetMock };
      }
    ).axios.get = axiosGetMock;

    const result = await api.getMovieCover(42);

    assert.deepStrictEqual(result.imageBuffer, Buffer.from('movie-image'));
    assert.strictEqual(result.contentType, 'image/jpeg');
    assert.strictEqual(
      (
        axiosGetMock.mock.calls as unknown as {
          arguments: [string];
        }[]
      )[0].arguments[0],
      'http://localhost:7878/base/MediaCover/42/poster.jpg'
    );
  });

  it('falls back to the standard Radarr-compatible poster path', async () => {
    const api = new RadarrAPI({
      url: 'http://localhost:7878/api/v3',
      apiKey: 'key',
    });
    mock.method(api, 'getMovie', async () => movie());
    const axiosGetMock = mock.fn(async () => ({
      data: Buffer.from('fallback-movie-image'),
      headers: { 'content-type': 'image/png' },
    }));
    (
      api as unknown as {
        axios: { get: typeof axiosGetMock };
      }
    ).axios.get = axiosGetMock;

    const result = await api.getMovieCover(42);

    assert.deepStrictEqual(
      result.imageBuffer,
      Buffer.from('fallback-movie-image')
    );
    assert.strictEqual(
      (
        axiosGetMock.mock.calls as unknown as {
          arguments: [string];
        }[]
      )[0].arguments[0],
      'http://localhost:7878/MediaCover/42/poster.jpg'
    );
  });
});
