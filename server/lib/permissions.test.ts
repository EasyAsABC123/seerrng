import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_PERMISSION_VALUE,
  Permission,
  hasPermission,
  isValidPermissionValue,
} from './permissions';

describe('permission masks', () => {
  it('supports permission bits beyond JavaScript bitwise integer range', () => {
    const permissions = Permission.REQUEST_MUSIC + Permission.REQUEST_BOOK;

    assert.equal(hasPermission(Permission.REQUEST_MUSIC, permissions), true);
    assert.equal(hasPermission(Permission.REQUEST_BOOK, permissions), true);
    assert.equal(hasPermission(Permission.ADMIN, permissions), false);
  });

  it('fails closed on corrupt or unsupported persisted values', () => {
    for (const value of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      MAX_PERMISSION_VALUE + 1,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      assert.equal(isValidPermissionValue(value), false);
      assert.equal(hasPermission(Permission.ADMIN, value), false);
      assert.equal(hasPermission(Permission.REQUEST_BOOK, value), false);
    }
  });
});
