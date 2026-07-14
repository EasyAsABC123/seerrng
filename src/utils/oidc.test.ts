import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasOidcCallbackParameters } from './oidcQuery';

describe('hasOidcCallbackParameters', () => {
  it('only treats authorization responses as OIDC callbacks', () => {
    assert.equal(hasOidcCallbackParameters({ code: 'code' }), true);
    assert.equal(hasOidcCallbackParameters({ error: 'access_denied' }), true);
    assert.equal(hasOidcCallbackParameters({ provider: 'authentik' }), false);
    assert.equal(hasOidcCallbackParameters({}), false);
  });
});
