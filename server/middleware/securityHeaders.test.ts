import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import express from 'express';
import request from 'supertest';
import securityHeaders, {
  SECURITY_RESPONSE_HEADERS,
  buildContentSecurityPolicy,
} from './securityHeaders';

describe('security response headers', () => {
  it('prevents framing and MIME sniffing without exposing Express', async () => {
    const app = express();
    app.use(securityHeaders);
    app.get('/', (_req, res) => res.json({ ok: true }));

    const response = await request(app).get('/');

    assert.strictEqual(response.status, 200);
    for (const [name, value] of Object.entries(SECURITY_RESPONSE_HEADERS)) {
      assert.strictEqual(response.headers[name.toLowerCase()], value);
    }
    assert.match(response.headers['content-security-policy'], /base-uri/);
    assert.match(
      response.headers['content-security-policy'],
      /default-src 'self'/
    );
    assert.match(
      response.headers['content-security-policy'],
      /script-src 'self' 'unsafe-inline'/
    );
    assert.match(
      response.headers['content-security-policy'],
      /script-src-attr 'none'/
    );
    assert.match(
      response.headers['content-security-policy'],
      /connect-src 'self' https:\/\/plex\.tv https:\/\/\*\.plex\.tv/
    );
    assert.match(
      response.headers['content-security-policy'],
      /frame-src 'none'/
    );
    assert.doesNotMatch(
      response.headers['content-security-policy'],
      /unsafe-eval|(?:^|\s)\*(?:\s|;|$)/
    );
    assert.match(response.headers['content-security-policy'], /form-action/);
    assert.match(response.headers['content-security-policy'], /object-src/);
    assert.strictEqual(response.headers['x-powered-by'], undefined);
  });

  it('allows development hot reload transports only outside production', () => {
    const developmentPolicy = buildContentSecurityPolicy('development');
    const productionPolicy = buildContentSecurityPolicy('production');

    assert.match(developmentPolicy, /script-src[^;]*'unsafe-eval'/);
    assert.match(developmentPolicy, /connect-src[^;]*ws: wss:/);
    assert.match(developmentPolicy, /connect-src[^;]*https:\/\/plex\.tv/);
    assert.doesNotMatch(productionPolicy, /'unsafe-eval'|\bws:|\bwss:/);
  });
});
