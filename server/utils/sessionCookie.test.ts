import express from 'express';
import session from 'express-session';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { getSessionTransportOptions } from './sessionCookie';

const createApp = (development: boolean) => {
  const app = express();
  app.use(
    session({
      secret: '01234567890123456789012345678901',
      resave: false,
      saveUninitialized: false,
      ...getSessionTransportOptions(development, true),
    })
  );
  app.get('/', (req, res) => {
    req.session.userId = 1;
    res.json({ ok: true });
  });
  return app;
};

describe('getSessionTransportOptions', () => {
  it('always protects production session cookies across TLS termination', () => {
    assert.equal(getSessionTransportOptions(false, true).cookie.secure, true);
    assert.equal(getSessionTransportOptions(false, false).cookie.secure, true);
    assert.equal(getSessionTransportOptions(false, true).proxy, true);
  });

  it('retains development HTTP support and CSRF-aware same-site policy', () => {
    assert.equal(getSessionTransportOptions(true, true).cookie.secure, false);
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

  it('fails closed when a production request has no TLS evidence', async () => {
    const response = await request(createApp(false)).get('/');

    assert.equal(response.get('Set-Cookie'), undefined);
  });
});
