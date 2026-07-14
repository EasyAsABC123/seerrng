import axios from 'axios';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getHttpErrorDetails,
  isTransientHttpError,
  withTransientHttpRetry,
} from './httpError';

describe('HTTP error utilities', () => {
  it('retains Axios status and error code', () => {
    const error = new axios.AxiosError(
      'upstream unavailable',
      'ECONNRESET',
      undefined,
      undefined,
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {},
        config: { headers: {} } as never,
        data: undefined,
      }
    );

    assert.deepEqual(getHttpErrorDetails(error), {
      errorMessage: 'upstream unavailable',
      errorCode: 'ECONNRESET',
      status: 503,
    });
    assert.equal(isTransientHttpError(error), true);
  });

  it('does not retry permanent client errors', async () => {
    const error = new axios.AxiosError(
      'not found',
      undefined,
      undefined,
      undefined,
      {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: { headers: {} } as never,
        data: undefined,
      }
    );
    let attempts = 0;

    await assert.rejects(
      withTransientHttpRetry(
        async () => {
          attempts += 1;
          throw error;
        },
        { maxAttempts: 3, delayMs: 0 }
      ),
      error
    );
    assert.equal(attempts, 1);
  });

  it('retries a transient failure once', async () => {
    const error = new axios.AxiosError('socket reset', 'ECONNRESET');
    let attempts = 0;

    const result = await withTransientHttpRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw error;
        }
        return 'ok';
      },
      { delayMs: 0 }
    );

    assert.equal(result, 'ok');
    assert.equal(attempts, 2);
  });
});
