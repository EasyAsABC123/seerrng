import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isLoginPath,
  isPublicAuthPath,
  isResetPasswordPath,
  isSetupPath,
} from './routeAccess';

describe('public authentication route matching', () => {
  it('accepts only declared routes and their path segments', () => {
    assert.strictEqual(isSetupPath('/setup'), true);
    assert.strictEqual(isSetupPath('/setup/login'), true);
    assert.strictEqual(isLoginPath('/login/plex'), true);
    assert.strictEqual(isResetPasswordPath('/resetpassword/token'), true);
    assert.strictEqual(isPublicAuthPath('/login'), true);
  });

  it('rejects lookalike protected paths', () => {
    for (const pathname of [
      '/setup-guide',
      '/movie/login-history',
      '/users/resetpasswords',
      '/catalog/setup',
      '/logins',
    ]) {
      assert.strictEqual(isPublicAuthPath(pathname), false, pathname);
    }
  });
});
