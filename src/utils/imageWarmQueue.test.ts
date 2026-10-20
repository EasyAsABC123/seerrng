import { AxiosError, AxiosHeaders } from 'axios';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IMAGE_WARM_DEFAULT_BACKOFF_MS,
  IMAGE_WARM_MAX_BATCH,
  IMAGE_WARM_MIN_INTERVAL_MS,
  createImageWarmQueue,
  getRetryDelayMs,
} from './imageWarmQueue';

const createClock = () => {
  let now = 0;
  const timers: { at: number; run: () => void; id: number }[] = [];
  let nextId = 1;
  return {
    timers: {
      now: () => now,
      set: (run: () => void, delayMs: number) => {
        const id = nextId++;
        timers.push({ at: now + delayMs, run, id });
        return id;
      },
      clear: (handle: unknown) => {
        const index = timers.findIndex((timer) => timer.id === handle);
        if (index >= 0) timers.splice(index, 1);
      },
    },
    // Advance time, running due timers (and the async work they start).
    async advance(ms: number) {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        now = Math.max(now, next.at);
        next.run();
        await new Promise((resolve) => setImmediate(resolve));
      }
      now = end;
    },
  };
};

const rateLimited = (headers: Record<string, string> = {}) =>
  new AxiosError('Too Many Requests', '429', undefined, undefined, {
    status: 429,
    statusText: 'Too Many Requests',
    data: '',
    headers: new AxiosHeaders(headers),
    config: { headers: new AxiosHeaders() },
  });

describe('image warm queue', () => {
  it('coalesces many components into one request per interval', async () => {
    const clock = createClock();
    const posts: string[][] = [];
    const queue = createImageWarmQueue(
      async (urls) => void posts.push(urls),
      clock.timers,
      () => false
    );

    // Ten shelves mount in the same moment; the old code made ten requests.
    for (let shelf = 0; shelf < 10; shelf++) {
      queue.enqueue([`https://img/${shelf}-a.jpg`, 'https://img/shared.jpg']);
    }
    await clock.advance(0);

    assert.equal(posts.length, 1);
    assert.equal(posts[0].length, 11);
    assert.equal(new Set(posts[0]).size, 11);
  });

  it('never exceeds the server batch size and spaces batches out', async () => {
    const clock = createClock();
    const posts: { at: number; urls: string[] }[] = [];
    const queue = createImageWarmQueue(
      async (urls) => void posts.push({ at: clock.timers.now(), urls }),
      clock.timers,
      () => false
    );

    queue.enqueue(
      Array.from({ length: IMAGE_WARM_MAX_BATCH * 2 + 5 }, (_, i) => `u${i}`)
    );
    await clock.advance(IMAGE_WARM_MIN_INTERVAL_MS * 5);

    assert.deepEqual(
      posts.map((post) => post.urls.length),
      [IMAGE_WARM_MAX_BATCH, IMAGE_WARM_MAX_BATCH, 5]
    );
    assert.ok(posts[1].at - posts[0].at >= IMAGE_WARM_MIN_INTERVAL_MS);
    assert.ok(posts[2].at - posts[1].at >= IMAGE_WARM_MIN_INTERVAL_MS);
  });

  it('does not resend URLs that were already warmed', async () => {
    const clock = createClock();
    const posts: string[][] = [];
    const queue = createImageWarmQueue(
      async (urls) => void posts.push(urls),
      clock.timers,
      () => false
    );

    queue.enqueue(['a', 'b']);
    await clock.advance(IMAGE_WARM_MIN_INTERVAL_MS);
    queue.enqueue(['a', 'b', 'c']);
    await clock.advance(IMAGE_WARM_MIN_INTERVAL_MS);

    assert.deepEqual(posts, [['a', 'b'], ['c']]);
  });

  it('keeps the batch and waits out a 429 instead of retrying immediately', async () => {
    const clock = createClock();
    let calls = 0;
    const times: number[] = [];
    const queue = createImageWarmQueue(
      async () => {
        calls++;
        times.push(clock.timers.now());
        if (calls === 1) throw rateLimited({ 'retry-after': '20' });
      },
      clock.timers,
      () => false
    );

    queue.enqueue(['a']);
    await clock.advance(1000);
    assert.equal(calls, 1, 'no retry while the server said wait');
    await clock.advance(19_000);
    assert.equal(calls, 2, 'retries once the wait has passed');
    assert.ok(times[1] - times[0] >= 20_000);
    assert.equal(queue.pendingCount, 0);
  });

  it('drops a batch on non-rate-limit errors and keeps working', async () => {
    const clock = createClock();
    const posts: string[][] = [];
    let first = true;
    const queue = createImageWarmQueue(
      async (urls) => {
        posts.push(urls);
        if (first) {
          first = false;
          throw new Error('network down');
        }
      },
      clock.timers,
      () => false
    );

    queue.enqueue(['a']);
    await clock.advance(0);
    queue.enqueue(['b']);
    await clock.advance(IMAGE_WARM_MIN_INTERVAL_MS);

    assert.deepEqual(posts, [['a'], ['b']]);
  });

  it('waits while the tab is hidden', async () => {
    const clock = createClock();
    let hidden = true;
    const posts: string[][] = [];
    const queue = createImageWarmQueue(
      async (urls) => void posts.push(urls),
      clock.timers,
      () => hidden
    );

    queue.enqueue(['a']);
    await clock.advance(IMAGE_WARM_MIN_INTERVAL_MS * 3);
    assert.equal(posts.length, 0);
    hidden = false;
    await clock.advance(IMAGE_WARM_MIN_INTERVAL_MS);
    assert.deepEqual(posts, [['a']]);
  });

  it('reads Retry-After and RateLimit-Reset, with a bounded default', () => {
    assert.equal(getRetryDelayMs(rateLimited({ 'retry-after': '7' })), 7000);
    assert.equal(
      getRetryDelayMs(rateLimited({ 'ratelimit-reset': '9' })),
      9000
    );
    assert.equal(getRetryDelayMs(rateLimited()), IMAGE_WARM_DEFAULT_BACKOFF_MS);
    assert.equal(
      getRetryDelayMs(rateLimited({ 'retry-after': '99999' })),
      120_000
    );
    assert.equal(getRetryDelayMs(new Error('x')), undefined);
  });
});
