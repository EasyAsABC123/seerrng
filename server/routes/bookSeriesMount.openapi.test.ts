import assert from 'node:assert/strict';
import path from 'node:path';
import { before, beforeEach, describe, it } from 'node:test';

import { getSettings } from '@server/lib/settings';
import router from '@server/routes';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import session from 'express-session';
import request from 'supertest';

setupTestDb();

describe('Book Series routes through the main API router', () => {
  let app: Express;

  before(() => {
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: 'test-secret',
        cookie: { secure: 'auto' },
        resave: false,
        saveUninitialized: false,
      })
    );
    app.use(
      OpenApiValidator.middleware({
        apiSpec: path.join(process.cwd(), 'seerr-api.yml'),
        validateRequests: true,
        validateSecurity: false,
      })
    );
    app.use('/api/v1', router);
    app.use(
      (
        error: { status?: number; message?: string },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        void _next;
        return res.status(error.status ?? 500).json({
          status: error.status ?? 500,
          message: error.message,
        });
      }
    );
  });

  beforeEach(() => {
    getSettings().main.localLogin = true;
  });

  const loginAsAdmin = async () => {
    const admin = request.agent(app);
    const response = await admin
      .post('/api/v1/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return admin;
  };

  it('mounts the Book Series monitoring request list', async () => {
    const admin = await loginAsAdmin();
    const response = await admin
      .get('/api/v1/book-series/watch/requests')
      .expect(200);
    assert.deepEqual(response.body, []);
  });
});
