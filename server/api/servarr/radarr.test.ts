import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { RadarrMovie } from '@server/api/servarr/radarr';
import axios from 'axios';
import RadarrAPI, { sanitizeRadarrMovie } from './radarr';

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

  it('falls back to an advertised remote poster when local media cover is not an image', async () => {
    const api = new RadarrAPI({
      url: 'http://localhost:7878/api/v3',
      apiKey: 'key',
    });
    mock.method(api, 'getMovie', async () =>
      movie({
        images: [
          {
            coverType: 'poster',
            url: '/MediaCover/42/poster.jpg?lastWrite=123',
            remoteUrl: 'https://image.tmdb.org/t/p/original/poster.jpg',
          },
        ],
      })
    );
    const axiosGetMock = mock.fn(async () => ({
      data: Buffer.from('login-page'),
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
    (
      api as unknown as {
        axios: { get: typeof axiosGetMock };
      }
    ).axios.get = axiosGetMock;
    const remoteGetMock = mock.method(axios, 'get', async () => ({
      data: Buffer.from('remote-movie-image'),
      headers: { 'content-type': 'image/jpeg' },
    }));

    const result = await api.getMovieCover(42);

    assert.deepStrictEqual(
      result.imageBuffer,
      Buffer.from('remote-movie-image')
    );
    assert.strictEqual(result.contentType, 'image/jpeg');
    assert.strictEqual(
      remoteGetMock.mock.calls[0].arguments[0],
      'https://image.tmdb.org/t/p/original/poster.jpg'
    );
    assert.deepStrictEqual(remoteGetMock.mock.calls[0].arguments[1], {
      responseType: 'arraybuffer',
      headers: { Accept: 'image/*' },
    });
  });
});
