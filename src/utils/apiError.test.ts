import { describe, expect, it } from 'vitest';
import { getSafeApiErrorDetails } from './apiError';

const axiosError = (status?: number, message?: unknown) => ({
  isAxiosError: true,
  response: status === undefined ? undefined : { status, data: { message } },
});

describe('getSafeApiErrorDetails', () => {
  it('keeps bounded validation messages for client errors', () => {
    expect(
      getSafeApiErrorDetails(axiosError(400, 'activeProfileId is invalid.'))
    ).toEqual({ status: 400, message: 'activeProfileId is invalid.' });
  });

  it('does not surface server error details', () => {
    expect(
      getSafeApiErrorDetails(axiosError(500, '/config/settings.json: EACCES'))
    ).toEqual({ status: 500 });
  });

  it('removes control characters and truncates response messages', () => {
    const details = getSafeApiErrorDetails(
      axiosError(409, `  limit\n${'x'.repeat(300)}`)
    );

    expect(details.status).toBe(409);
    expect(details.message).toHaveLength(240);
    expect(
      [...(details.message ?? '')].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 0x1f || code === 0x7f;
      })
    ).toBe(false);
  });

  it('does not treat ordinary errors as API responses', () => {
    expect(getSafeApiErrorDetails(new Error('offline'))).toEqual({});
    expect(getSafeApiErrorDetails(axiosError())).toEqual({});
  });
});
