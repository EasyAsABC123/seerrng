import { AxiosError } from 'axios';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isTautulliNoDataError, TAUTULLI_HTTP_LIMITS } from './tautulli';

describe('TAUTULLI_HTTP_LIMITS', () => {
  it('bounds outbound Tautulli requests', () => {
    assert.equal(TAUTULLI_HTTP_LIMITS.maxContentLength, 2 * 1024 * 1024);
    assert.equal(TAUTULLI_HTTP_LIMITS.maxBodyLength, 1024);
  });
});

describe('isTautulliNoDataError', () => {
  it('recognizes a wrapped Tautulli 400 response', () => {
    const axiosError = new AxiosError(
      'No stats',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      { status: 400 } as never
    );
    const wrapped = new Error('Tautulli request failed', { cause: axiosError });

    assert.strictEqual(isTautulliNoDataError(wrapped), true);
    assert.strictEqual(isTautulliNoDataError(new Error('offline')), false);
  });
});
