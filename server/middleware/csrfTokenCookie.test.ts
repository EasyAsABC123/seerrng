import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import express from 'express';
import request from 'supertest';
import csrfTokenCookie from './csrfTokenCookie';

describe('csrfTokenCookie', () => {
  it('makes the browser-readable token available across application routes', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.csrfToken = () => 'test-token';
      next();
    });
    app.use(csrfTokenCookie(false));
    app.get('/nested/page', (_req, res) => res.sendStatus(204));

    const response = await request(app).get('/nested/page');
    const tokenCookie = response
      .get('Set-Cookie')
      ?.find((cookie) => cookie.startsWith('XSRF-TOKEN='));

    assert.ok(tokenCookie);
    assert.match(tokenCookie, /(?:^|;) Path=\/(?:;|$)/);
    assert.match(tokenCookie, /(?:^|;) SameSite=Strict(?:;|$)/);
    assert.doesNotMatch(tokenCookie, /(?:^|;) HttpOnly(?:;|$)/);
  });
});
