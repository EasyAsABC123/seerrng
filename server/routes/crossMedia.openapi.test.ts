import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import type { Express } from 'express';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import request from 'supertest';

// The production server rejects undocumented paths, unknown query parameters,
// and body types the spec does not list. These tests pin the new surface to
// the spec with stub handlers.
describe('cross-media routes behind the OpenAPI validator', () => {
  let app: Express;

  before(() => {
    app = express();
    app.use(express.json());
    app.use(
      OpenApiValidator.middleware({
        apiSpec: path.join(process.cwd(), 'seerr-api.yml'),
        validateRequests: true,
        validateSecurity: false,
      })
    );
    const ok = (_req: express.Request, res: express.Response) =>
      res.status(200).json({ ok: true });
    app.get('/api/v1/resolve/capabilities', ok);
    app.post('/api/v1/resolve', ok);
    app.post('/api/v1/resolve/image', express.raw({ type: () => true }), ok);
    app.get('/api/v1/continuation/tv/:tvId', ok);
    app.get('/api/v1/editions/book', ok);
    app.get('/api/v1/follow', ok);
    app.post('/api/v1/follow', ok);
    app.get('/api/v1/follow/events', ok);
    app.post('/api/v1/follow/events/seen', (_req, res) =>
      res.status(204).end()
    );
    app.get('/api/v1/franchise/:mediaType/:id', ok);
    app.post('/api/v1/game-content/discover', ok);
    app.get('/api/v1/patches/search', ok);
    app.get('/api/v1/vibes', ok);
    app.get('/api/v1/collectors', ok);
    app.get('/api/v1/settings/recognition', ok);
    app.use(
      (
        err: { status?: number; message?: string },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => (void _next, res.status(err.status ?? 500).json(err))
    );
  });

  after(() => undefined);

  it('accepts a raw image upload of each supported type', async () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      const response = await request(app)
        .post('/api/v1/resolve/image?formatHint=audiobook')
        .set('Content-Type', type)
        .send(Buffer.from('89504e470d0a1a0a', 'hex'));
      assert.equal(response.status, 200, type);
    }
  });

  it('accepts documented query parameters and rejects unknown ones', async () => {
    assert.equal(
      (
        await request(app).get(
          '/api/v1/editions/book?format=audiobook&title=Dune&term=Dune&mediaId=3'
        )
      ).status,
      200
    );
    assert.notEqual(
      (await request(app).get('/api/v1/editions/book?format=audiobook&bogus=1'))
        .status,
      200
    );
    assert.equal(
      (
        await request(app).get(
          '/api/v1/patches/search?q=a&platform=gba&kind=translation&completeOnly=true'
        )
      ).status,
      200
    );
    assert.equal(
      (
        await request(app).get(
          '/api/v1/continuation/tv/94605?season=2&language=en'
        )
      ).status,
      200
    );
  });

  it('rejects invalid values', async () => {
    assert.notEqual(
      (await request(app).get('/api/v1/editions/book?format=vinyl')).status,
      200
    );
    assert.notEqual(
      (
        await request(app)
          .post('/api/v1/follow')
          .send({ kind: 'nonsense', subjectKey: 'x', subjectLabel: 'x' })
      ).status,
      201
    );
  });

  it('knows every new path', async () => {
    for (const url of [
      '/api/v1/resolve/capabilities',
      '/api/v1/follow',
      '/api/v1/follow/events?take=10&unseen=true',
      '/api/v1/franchise/tv/94605?language=en',
      '/api/v1/vibes',
      '/api/v1/collectors',
      '/api/v1/settings/recognition',
    ]) {
      assert.equal((await request(app).get(url)).status, 200, url);
    }
    assert.equal(
      (
        await request(app)
          .post('/api/v1/game-content/discover')
          .send({ filters: { themes: ['Horror'] } })
      ).status,
      200
    );
  });
});
