import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import csrfProtection, { requestUsesSecureTransport } from './csrfProtection';
import csrfTokenCookie from './csrfTokenCookie';

const getCsrfCookies = (cookies: string[] = []) => ({
  secret: cookies.find((cookie) => cookie.startsWith('_csrf=')),
  token: cookies.find((cookie) => cookie.startsWith('XSRF-TOKEN=')),
});

const getCookieValue = (cookie: string): string =>
  decodeURIComponent(
    cookie.slice(cookie.indexOf('=') + 1, cookie.indexOf(';'))
  );

const createTransportAwareApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(csrfProtection());
  app.use(csrfTokenCookie(requestUsesSecureTransport));
  app.get('/', (_req, res) => res.sendStatus(204));
  app.post('/', (_req, res) => res.sendStatus(204));
  return app;
};

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

  it('allows both CSRF cookies on direct HTTP deployments', async () => {
    const agent = request.agent(createTransportAwareApp());
    const response = await agent.get('/');
    const cookies = getCsrfCookies(response.get('Set-Cookie'));

    assert.ok(cookies.secret);
    assert.ok(cookies.token);
    assert.doesNotMatch(cookies.secret, /(?:^|;) Secure(?:;|$)/);
    assert.doesNotMatch(cookies.token, /(?:^|;) Secure(?:;|$)/);

    await agent
      .post('/')
      .set('X-XSRF-TOKEN', getCookieValue(cookies.token))
      .expect(204);
  });

  it('secures both CSRF cookies behind an HTTPS terminator', async () => {
    const response = await request(createTransportAwareApp())
      .get('/')
      .set('X-Forwarded-Proto', 'https');
    const cookies = getCsrfCookies(response.get('Set-Cookie'));

    assert.ok(cookies.secret);
    assert.ok(cookies.token);
    assert.match(cookies.secret, /(?:^|;) Secure(?:;|$)/);
    assert.match(cookies.token, /(?:^|;) Secure(?:;|$)/);
  });
});
