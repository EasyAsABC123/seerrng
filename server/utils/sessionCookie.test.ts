import express from 'express';
import session from 'express-session';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { getSessionTransportOptions } from './sessionCookie';

const createApp = (development: boolean) => {
  const app = express();
  const transportOptions = getSessionTransportOptions(development, true);
  app.use(
    session({
      secret: '01234567890123456789012345678901',
      resave: false,
      saveUninitialized: false,
      ...transportOptions,
    })
  );
  app.get('/', (req, res) => {
    req.session.userId = 1;
    res.json({ ok: true });
  });
  return app;
};

describe('getSessionTransportOptions', () => {
  it('selects cookie security from the request transport', () => {
    assert.equal(getSessionTransportOptions(false, true).cookie.secure, 'auto');
    assert.equal(
      getSessionTransportOptions(false, false).cookie.secure,
      'auto'
    );
    assert.equal(getSessionTransportOptions(false, true).proxy, true);
  });

  it('keeps the remaining cookie protections in development and production', () => {
    assert.equal(getSessionTransportOptions(true, true).cookie.secure, 'auto');
    assert.equal(
      getSessionTransportOptions(true, true).cookie.sameSite,
      'strict'
    );
    assert.equal(
      getSessionTransportOptions(true, false).cookie.sameSite,
      'lax'
    );
    assert.equal(getSessionTransportOptions(true, true).cookie.httpOnly, true);
    assert.equal(
      getSessionTransportOptions(true, true).cookie.maxAge,
      30 * 24 * 60 * 60 * 1_000
    );
    assert.equal(getSessionTransportOptions(true, true).proxy, false);
  });

  it('emits a secure production cookie from a TLS terminator without global proxy trust', async () => {
    const response = await request(createApp(false))
      .get('/')
      .set('X-Forwarded-Proto', 'https');

    assert.match(response.get('Set-Cookie')?.[0] ?? '', /; Secure(?:;|$)/);
  });

  it('emits a non-secure cookie for a direct HTTP LAN request', async () => {
    const response = await request(createApp(false)).get('/');

    const cookie = response.get('Set-Cookie')?.[0] ?? '';
    assert.notEqual(cookie, '');
    assert.doesNotMatch(cookie, /; Secure(?:;|$)/);
  });
});
