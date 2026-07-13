import { useEffect, useState } from 'react';
import type { Cache } from 'swr';

const RESPONSE_CACHE_PREFIX = 'seerr-response-cache-v1:';
const MAX_RESPONSE_CACHE_AGE = 1000 * 60 * 60 * 24;

type CacheRecord<T> = {
  timestamp: number;
  data: T;
};

const canUseStorage = () =>
  typeof window !== 'undefined' && !!window.localStorage;

const readJson = <T>(key: string): T | undefined => {
  if (!canUseStorage()) {
    return undefined;
  }

  try {
    const value = window.localStorage.getItem(key);

    return value ? (JSON.parse(value) as T) : undefined;
  } catch {
    return undefined;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    window.localStorage.removeItem(key);
  }
};

const getResponseCacheKey = (key: string) =>
  `${RESPONSE_CACHE_PREFIX}${encodeURIComponent(key)}`;

export const getPersistentResponse = <T>(key: string): T | undefined => {
  const record = readJson<CacheRecord<T>>(getResponseCacheKey(key));

  if (!record) {
    return undefined;
  }

  if (Date.now() - record.timestamp > MAX_RESPONSE_CACHE_AGE) {
    window.localStorage.removeItem(getResponseCacheKey(key));
    return undefined;
  }

  return record.data;
};

export const setPersistentResponse = <T>(key: string, data: T | undefined) => {
  if (data === undefined) {
    return;
  }

  writeJson(getResponseCacheKey(key), {
    timestamp: Date.now(),
    data,
  });
};

export const usePersistentResponse = <T>(key: string): T | undefined => {
  const [response, setResponse] = useState<{ key: string; data?: T }>();

  useEffect(() => {
    setResponse({ key, data: getPersistentResponse<T>(key) });
  }, [key]);

  return response?.key === key ? response.data : undefined;
};

// SWR's shared in-memory cache handles navigation deduplication. Persisted
// discover fallbacks are restored explicitly after hydration above; storing
// every authenticated API response in localStorage risks stale cross-user data.
export const createPersistentSWRCache = (): Cache =>
  new Map<string, unknown>() as Cache;
