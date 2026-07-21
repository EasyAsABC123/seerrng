import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALL_NOTIFICATIONS,
  deserializeNotificationTypes,
  serializeNotificationTypes,
} from './UserSettings';

describe('deserializeNotificationTypes', () => {
  it('preserves valid values and supplies defaults', () => {
    assert.deepStrictEqual(deserializeNotificationTypes('{"pushover":4}'), {
      pushover: 4,
      email: ALL_NOTIFICATIONS,
      webpush: ALL_NOTIFICATIONS,
    });
  });

  it('recovers from malformed and non-object database values', () => {
    for (const value of ['{invalid', '2', '[]', 'null']) {
      const result = deserializeNotificationTypes(value);
      assert.strictEqual(result.email, ALL_NOTIFICATIONS);
      assert.strictEqual(result.webpush, ALL_NOTIFICATIONS);
      assert.strictEqual(result.pushover, 0);
    }
  });

  it('drops unknown keys, types, and notification bits from stored JSON', () => {
    assert.deepStrictEqual(
      deserializeNotificationTypes(
        JSON.stringify({
          email: 'all',
          pushover: 4,
          pushbullet: 1,
          unexpected: ALL_NOTIFICATIONS,
        })
      ),
      {
        pushover: 4,
        email: ALL_NOTIFICATIONS,
        webpush: ALL_NOTIFICATIONS,
      }
    );
  });

  it('serializes a sanitized copy without mutating the caller', () => {
    const value = {
      pushover: 4,
      pushbullet: 1,
      unexpected: ALL_NOTIFICATIONS,
    };

    assert.strictEqual(serializeNotificationTypes(value), '{"pushover":4}');
    assert.deepStrictEqual(value, {
      pushover: 4,
      pushbullet: 1,
      unexpected: ALL_NOTIFICATIONS,
    });
  });
});
