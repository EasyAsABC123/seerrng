import assert from 'node:assert/strict';
import { afterEach, before, describe, it, mock } from 'node:test';

import RadarrAPI from '@server/api/servarr/radarr';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import request from 'supertest';
import movieRoutes from './movie';

let app: Express;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/movie', movieRoutes);
  return app;
}

before(() => {
  app = createApp();
});

afterEach(() => {
  mock.restoreAll();
});

setupTestDb();

describe('GET /movie/:id/cover', () => {
  it('serves linked Radarr covers through the configured service', async () => {
    const settings = getSettings();
    const priorRadarr = settings.radarr;
    settings.radarr = [
      {
        id: 9,
        name: 'Radarr',
        hostname: 'radarr.test',
        port: 7878,
        apiKey: 'radarr-key',
        useSsl: false,
        baseUrl: '',
        activeProfileId: 1,
        activeProfileName: 'Any',
        activeDirectory: '/movies',
        tags: [],
        is4k: false,
        isDefault: true,
        externalUrl: '',
        syncEnabled: true,
        preventSearch: false,
        tagRequests: false,
        overrideRule: [],
        minimumAvailability: 'released',
      },
    ];
    const getMovieCoverMock = mock.method(
      RadarrAPI.prototype,
      'getMovieCover',
      async () => ({
        imageBuffer: Buffer.from('movie-cover'),
        contentType: 'image/jpeg',
      })
    );

    try {
      const media = await getRepository(Media).save(
        new Media({
          tmdbId: 100,
          mediaType: MediaType.MOVIE,
          serviceId: 9,
          externalServiceId: 44,
          externalServiceSlug: 'test-movie',
        })
      );

      const res = await request(app).get(
        `/movie/100/cover?mediaId=${media.id}&is4k=false`
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['content-type'], 'image/jpeg');
      assert.deepStrictEqual(res.body, Buffer.from('movie-cover'));
      assert.strictEqual(getMovieCoverMock.mock.calls[0].arguments[0], 44);
    } finally {
      settings.radarr = priorRadarr;
    }
  });
});
