import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { AxiosInstance } from 'axios';

import WhisparrAPI from './whisparr';

const buildWhisparr = (): WhisparrAPI =>
  new WhisparrAPI({
    url: 'http://localhost:8989/whisparr/api/v3',
    apiKey: 'test',
  });

const getAxios = (api: WhisparrAPI): AxiosInstance =>
  (api as unknown as { axios: AxiosInstance }).axios;

describe('Whisparr Adult scene catalog', () => {
  afterEach(() => mock.restoreAll());

  it('uses scene lookup and exposes only sanitized scene metadata', async () => {
    const api = buildWhisparr();
    const get = mock.method(getAxios(api), 'get', async () => ({
      data: [
        {
          foreignId: '8a3c0000-0000-4000-8000-000000000001',
          itemType: 'scene',
          title: 'Scene title',
          year: 2025,
          overview: 'A scene synopsis.',
          studioTitle: 'Studio',
          remotePoster: 'https://images.example/poster.jpg',
          images: [
            {
              coverType: 'poster',
              url: '/MediaCover/12/poster.jpg',
              remoteUrl: 'https://images.example/poster.jpg',
              secret: 'discard this',
            },
          ],
          performerNames: ['Performer One', 'Performer Two'],
          hasFile: true,
          providerSecret: 'discard this too',
        },
        {
          foreignId: '8a3c0000-0000-4000-8000-000000000002',
          itemType: 'movie',
          title: 'Not a scene',
        },
      ],
    }));

    const scenes = await api.searchScenes('Performer One');

    assert.equal(scenes.length, 1);
    assert.equal(scenes[0].title, 'Scene title');
    assert.equal(scenes[0].studio, 'Studio');
    assert.deepEqual(scenes[0].performerNames, [
      'Performer One',
      'Performer Two',
    ]);
    assert.equal(scenes[0].images[0].url, '/MediaCover/12/poster.jpg');
    assert.ok(!('providerSecret' in scenes[0]));
    assert.ok(!('secret' in scenes[0].images[0]));
    const options = get.mock.calls[0].arguments[1] as
      { params?: Record<string, unknown> } | undefined;
    assert.deepEqual(options?.params, {
      term: 'Performer One',
      itemType: 'scene',
    });
  });

  it('normalizes library scenes and ignores records that are not scenes', async () => {
    const api = buildWhisparr();
    mock.method(getAxios(api), 'get', async () => ({
      data: [
        {
          id: 12,
          foreignId: '8a3c0000-0000-4000-8000-000000000001',
          itemType: 'scene',
          title: 'Library scene',
          added: '2026-10-01T12:00:00Z',
          hasFile: true,
          performerNames: ['Performer One'],
          tags: [1, 'invalid', 2],
          monitored: true,
          path: '/adult/Library scene',
        },
        {
          id: 13,
          foreignId: '8a3c0000-0000-4000-8000-000000000002',
          itemType: 'movie',
          title: 'A movie record',
        },
      ],
    }));

    const scenes = await api.getScenes();

    assert.equal(scenes.length, 1);
    assert.equal(scenes[0].added, '2026-10-01T12:00:00.000Z');
    assert.equal(scenes[0].hasFile, true);
    assert.deepEqual(scenes[0].tags, [1, 2]);
  });

  it('loads poster images through the configured Whisparr URL base', async () => {
    const api = buildWhisparr();
    const requestedUrls: string[] = [];
    mock.method(getAxios(api), 'get', async (url: string) => {
      requestedUrls.push(url);
      if (url.endsWith('/movie/lookup')) {
        return {
          data: [
            {
              foreignId: '8a3c0000-0000-4000-8000-000000000001',
              itemType: 'scene',
              title: 'Scene with poster',
              images: [
                { coverType: 'poster', url: '/MediaCover/12/poster.jpg' },
              ],
            },
          ],
        };
      }
      return {
        data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        headers: { 'content-type': 'image/jpeg' },
      };
    });

    const result = await api.getSceneCover(
      '8a3c0000-0000-4000-8000-000000000001'
    );

    assert.deepEqual(requestedUrls, [
      'http://localhost:8989/whisparr/api/v3/movie/lookup',
      'http://localhost:8989/whisparr/MediaCover/12/poster.jpg',
    ]);
    assert.equal(result.contentType, 'image/jpeg');
    assert.equal(result.imageBuffer.length, 4);
  });
});
