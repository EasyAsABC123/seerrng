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
