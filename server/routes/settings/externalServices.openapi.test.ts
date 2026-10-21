import assert from 'node:assert/strict';
import path from 'node:path';
import { before, describe, it } from 'node:test';

import { User } from '@server/entity/User';
import { initI18n } from '@server/i18n';
import { Permission } from '@server/lib/permissions';
import adultRoutes from '@server/routes/adult';
import serviceRoutes from '@server/routes/service';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import request from 'supertest';

import settingsRoutes from '@server/routes/settings';

const createOpenApiValidatedApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = new User({ id: 1, permissions: Permission.ADMIN });
    next();
  });
  app.use(
    OpenApiValidator.middleware({
      apiSpec: path.join(process.cwd(), 'seerr-api.yml'),
      validateRequests: true,
      validateSecurity: false,
    })
  );
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/adult', adultRoutes);
  app.use('/api/v1/service', serviceRoutes);
  app.use(
    (
      error: { status?: number; message?: string; errors?: unknown[] },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      void _next;
      return res.status(error.status ?? 500).json({
        status: error.status ?? 500,
        message: error.message,
        errors: error.errors,
      });
    }
  );
  return app;
};

setupTestDb();

before(() => {
  initI18n();
});

describe('external media-service settings behind the OpenAPI validator', () => {
  it('lets Whisparr, Navidrome, and Jellystat settings reads reach their handlers', async () => {
    const app = createOpenApiValidatedApp();

    const whisparr = await request(app)
      .get('/api/v1/settings/whisparr')
      .expect(200);
    const navidrome = await request(app)
      .get('/api/v1/settings/navidrome')
      .expect(200);
    const jellystat = await request(app)
      .get('/api/v1/settings/jellystat')
      .expect(200);

    assert.ok(Array.isArray(whisparr.body));
    assert.ok(navidrome.body === null || typeof navidrome.body === 'object');
    assert.ok(jellystat.body === null || typeof jellystat.body === 'object');
  });

  it('recognizes the connection-test and Whisparr profile routes', async () => {
    const app = createOpenApiValidatedApp();

    for (const service of ['whisparr', 'navidrome', 'jellystat']) {
      const response = await request(app)
        .post(`/api/v1/settings/${service}/test`)
        .send({});
      assert.equal(response.status, 400, `${service} test route`);
      assert.notEqual(response.body.message, 'not found');
    }

    const profiles = await request(app).get(
      '/api/v1/settings/whisparr/999/profiles'
    );
    assert.equal(profiles.status, 404);
    assert.equal(profiles.body.message, 'Settings instance not found');
  });

  it('lets Whisparr discovery and service routes reach their handlers', async () => {
    const app = createOpenApiValidatedApp();

    const services = await request(app)
      .get('/api/v1/service/whisparr')
      .expect(200);
    assert.deepEqual(services.body, []);

    const search = await request(app).get('/api/v1/adult/search?serverId=999');
    assert.equal(search.status, 404, JSON.stringify(search.body));
    assert.equal(search.body.message, 'Whisparr server was not found.');

    const details = await request(app).get('/api/v1/adult/not-a-stash-scene');
    assert.equal(details.status, 404);
    assert.equal(details.body.message, 'Adult scene not found.');

    const cover = await request(app).get(
      '/api/v1/adult/not-a-stash-scene/cover'
    );
    assert.equal(cover.status, 404);
    assert.equal(cover.text, 'Adult scene cover not found.');
  });
});
