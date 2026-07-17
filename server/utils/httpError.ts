import axios from 'axios';

export type HttpErrorDetails = {
  errorMessage: string;
  errorCode?: string;
  status?: number;
};

export const getHttpErrorDetails = (error: unknown): HttpErrorDetails => {
  if (axios.isAxiosError(error)) {
    return {
      errorMessage: error.message || error.name || 'Unknown HTTP error',
      ...(error.code ? { errorCode: error.code } : {}),
      ...(error.response?.status ? { status: error.response.status } : {}),
    };
  }

  if (error instanceof Error) {
    return {
      errorMessage: error.message || error.name || 'Unknown error',
    };
  }

  return {
    errorMessage: String(error || 'Unknown error'),
  };
};

export const hasHttpStatus = (
  error: unknown,
  expectedStatus: number
): boolean => {
  if (
    !Number.isInteger(expectedStatus) ||
    expectedStatus < 100 ||
    expectedStatus > 599
  ) {
    return false;
  }

  let current = error;
  const seen = new Set<object>();

  for (
    let depth = 0;
    current !== undefined && current !== null && depth < 8;
    depth++
  ) {
    if (typeof current === 'object') {
      if (seen.has(current)) {
        return false;
      }
      seen.add(current);
    }

    if (
      axios.isAxiosError(current) &&
      current.response?.status === expectedStatus
    ) {
      return true;
    }

    const record =
      typeof current === 'object'
        ? (current as {
            status?: unknown;
            statusCode?: unknown;
            cause?: unknown;
            response?: { status?: unknown };
          })
        : undefined;
    if (
      record?.status === expectedStatus ||
      record?.statusCode === expectedStatus ||
      record?.response?.status === expectedStatus
    ) {
      return true;
    }

    const message =
      current instanceof Error
        ? current.message
        : typeof current === 'string'
          ? current
          : '';
    if (
      message.trim() === String(expectedStatus) ||
      new RegExp(
        `(?:http|status(?:\\s+code)?)\\D{0,20}${expectedStatus}(?:\\D|$)`,
        'i'
      ).test(message)
    ) {
      return true;
    }

    current = record?.cause;
  }

  return false;
};

export const isTransientHttpError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;

  return (
    status === undefined || status === 408 || status === 429 || status >= 500
  );
};

export const withTransientHttpRetry = async <T>(
  request: () => Promise<T>,
  {
    maxAttempts = 2,
    delayMs = 250,
    onRetry,
  }: {
    maxAttempts?: number;
    delayMs?: number;
    onRetry?: (error: unknown, nextAttempt: number) => void;
  } = {}
): Promise<T> => {
  let attempt = 1;

  while (true) {
    try {
      return await request();
    } catch (error) {
      if (attempt >= maxAttempts || !isTransientHttpError(error)) {
        throw error;
      }

      attempt += 1;
      onRetry?.(error, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};
