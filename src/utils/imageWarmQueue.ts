import axios from 'axios';

/**
 * Every slider and list on a page asks the server to warm its poster cache.
 * Posting once per component exceeded the server's per-client limit on an
 * ordinary page load, so the app rate-limited itself (429) and logged console
 * errors. All warm requests now share one queue: URLs are de-duplicated across
 * components, sent in bounded batches, at most one request is in flight, and a
 * 429 pauses the queue for the time the server asks for instead of retrying.
 */
export const IMAGE_WARM_MAX_BATCH = 100;
export const IMAGE_WARM_MIN_INTERVAL_MS = 4000;
export const IMAGE_WARM_DEFAULT_BACKOFF_MS = 30000;
export const IMAGE_WARM_MAX_BACKOFF_MS = 120000;
export const IMAGE_WARM_MAX_PENDING = 1000;
export const IMAGE_WARM_MAX_REMEMBERED = 5000;

type WarmPost = (urls: string[]) => Promise<unknown>;

type Timers = {
  set: (callback: () => void, delayMs: number) => unknown;
  clear: (handle: unknown) => void;
  now: () => number;
};

export const getRetryDelayMs = (error: unknown): number | undefined => {
  if (!axios.isAxiosError(error) || error.response?.status !== 429) {
    return undefined;
  }

  const headers = error.response.headers as
    Record<string, string | undefined> | undefined;
  const seconds = Number(
    headers?.['retry-after'] ?? headers?.['ratelimit-reset']
  );
  const delayMs =
    Number.isFinite(seconds) && seconds > 0
      ? seconds * 1000
      : IMAGE_WARM_DEFAULT_BACKOFF_MS;

  return Math.min(delayMs, IMAGE_WARM_MAX_BACKOFF_MS);
};

export const createImageWarmQueue = (
  post: WarmPost,
  timers: Timers = {
    set: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clear: (handle) =>
      globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    now: () => Date.now(),
  },
  isPaused: () => boolean = () =>
    typeof document !== 'undefined' && document.visibilityState === 'hidden'
) => {
  const pending = new Set<string>();
  const sent = new Set<string>();
  let inFlight = false;
  let nextAllowedAt = 0;
  let timer: unknown;

  const remember = (urls: string[]) => {
    for (const url of urls) {
      if (sent.size >= IMAGE_WARM_MAX_REMEMBERED) {
        // Oldest first: a Set iterates in insertion order.
        sent.delete(sent.values().next().value as string);
      }
      sent.add(url);
    }
  };

  const schedule = () => {
    if (timer !== undefined || inFlight || pending.size === 0) {
      return;
    }

    const delayMs = Math.max(0, nextAllowedAt - timers.now());
    timer = timers.set(() => {
      timer = undefined;
      void flush();
    }, delayMs);
  };

  const flush = async () => {
    if (inFlight || pending.size === 0) {
      return;
    }

    if (isPaused()) {
      // A hidden tab should not spend the shared budget; try again later.
      nextAllowedAt = timers.now() + IMAGE_WARM_MIN_INTERVAL_MS;
      schedule();
      return;
    }

    const batch = [...pending].slice(0, IMAGE_WARM_MAX_BATCH);
    batch.forEach((url) => pending.delete(url));
    inFlight = true;

    try {
      await post(batch);
      remember(batch);
      nextAllowedAt = timers.now() + IMAGE_WARM_MIN_INTERVAL_MS;
    } catch (error) {
      const retryDelayMs = getRetryDelayMs(error);
      if (retryDelayMs !== undefined) {
        // Rate limited: keep the batch and wait as long as the server asked.
        batch.forEach((url) => pending.add(url));
        nextAllowedAt = timers.now() + retryDelayMs;
      } else {
        // Warming is opportunistic; other failures are dropped, not retried.
        nextAllowedAt = timers.now() + IMAGE_WARM_MIN_INTERVAL_MS;
      }
    } finally {
      inFlight = false;
      schedule();
    }
  };

  return {
    enqueue(urls: string[]) {
      for (const url of urls) {
        if (pending.size >= IMAGE_WARM_MAX_PENDING) {
          break;
        }

        if (!sent.has(url)) {
          pending.add(url);
        }
      }
      schedule();
    },
    get pendingCount() {
      return pending.size;
    },
    dispose() {
      if (timer !== undefined) {
        timers.clear(timer);
        timer = undefined;
      }
      pending.clear();
    },
  };
};

const sharedQueue = createImageWarmQueue((urls) =>
  axios.post('/api/v1/imageproxy/warm', { urls })
);

export const enqueueImageWarm = (urls: string[]) => sharedQueue.enqueue(urls);
