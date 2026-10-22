import axios from 'axios';

export interface SafeApiErrorDetails {
  status?: number;
  message?: string;
}

/** Return only a bounded client-error message; never surface server internals. */
export const getSafeApiErrorDetails = (error: unknown): SafeApiErrorDetails => {
  if (!axios.isAxiosError<{ message?: unknown }>(error)) return {};

  const status = error.response?.status;
  const responseMessage = error.response?.data?.message;
  const safeMessage =
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    typeof responseMessage === 'string'
      ? Array.from(responseMessage, (character) => {
          const code = character.charCodeAt(0);
          return code <= 0x1f || code === 0x7f ? ' ' : character;
        })
          .join('')
          .trim()
          .slice(0, 240)
      : undefined;

  return {
    ...(status !== undefined ? { status } : {}),
    ...(safeMessage ? { message: safeMessage } : {}),
  };
};
