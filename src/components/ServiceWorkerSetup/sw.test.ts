import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

type Listener = (event: Record<string, unknown>) => void;

class MemoryCache {
  private entries = new Map<string, Response>();

  async delete(request: Request | string) {
    return this.entries.delete(this.key(request));
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async match(request: Request | string) {
    return this.entries.get(this.key(request))?.clone();
  }

  async put(request: Request | string, response: Response) {
    this.entries.set(this.key(request), response.clone());
  }

  private key(request: Request | string) {
    return typeof request === 'string' ? request : request.url;
  }
}

const createHarness = () => {
  const listeners = new Map<string, Listener>();
  const cacheStores = new Map<string, MemoryCache>();
  const networkResponses: (Response | Error)[] = [];
  const shownNotifications: { subject: string; options: unknown }[] = [];
  const openedWindows: string[] = [];

  const caches = {
    delete: async (name: string) => cacheStores.delete(name),
    keys: async () => [...cacheStores.keys()],
    open: async (name: string) => {
      const cache = cacheStores.get(name) ?? new MemoryCache();
      cacheStores.set(name, cache);
      return cache;
    },
  };

  const self = {
    addEventListener: (type: string, listener: Listener) =>
      listeners.set(type, listener),
    location: { origin: 'https://seerr.test' },
    registration: {
      navigationPreload: { enable: async () => undefined },
      showNotification: async (subject: string, options: unknown) => {
        shownNotifications.push({ subject, options });
      },
    },
    skipWaiting: () => undefined,
  };

  runInNewContext(
    readFileSync(resolve(__dirname, '../../../public/sw.js'), 'utf8'),
    {
      caches,
      clients: {
        claim: () => undefined,
        openWindow: async (url: string) => {
          openedWindows.push(url);
        },
      },
      console,
      encodeURIComponent,
      fetch: async () => {
        const nextResponse = networkResponses.shift();
        if (nextResponse instanceof Error) {
          throw nextResponse;
        }
        return nextResponse ?? new Response(null, { status: 503 });
      },
      Headers,
      Map,
      navigator: {},
      Number,
      Promise,
      Request,
      Response,
      self,
      URL,
    }
  );

  const setUser = async (
    userId: number | null,
    permissions = 0,
    userType = 2
  ) => {
    const lifetimes: Promise<unknown>[] = [];
    listeners.get('message')?.({
      data: { type: 'SET_CACHE_USER', userId, permissions, userType },
      origin: self.location.origin,
      source: { id: 'client-1' },
      waitUntil: (promise: Promise<unknown>) => lifetimes.push(promise),
    });
    await Promise.all(lifetimes);
  };

  const activate = async () => {
    const lifetimes: Promise<unknown>[] = [];
    listeners.get('activate')?.({
      waitUntil: (promise: Promise<unknown>) => lifetimes.push(promise),
    });
    await Promise.all(lifetimes);
  };

  const fetchRequest = async (request: Request) => {
    let responsePromise: Promise<Response> | undefined;
    const lifetimes: Promise<unknown>[] = [];
    listeners.get('fetch')?.({
      clientId: 'client-1',
      preloadResponse: Promise.resolve(undefined),
      request,
      respondWith: (promise: Promise<Response>) => {
        responsePromise = promise;
      },
      waitUntil: (promise: Promise<unknown>) => lifetimes.push(promise),
    });

    const response = responsePromise ? await responsePromise : undefined;
    await Promise.all(lifetimes);
    return response;
  };

  const dispatchPush = async (payload: unknown) => {
    const lifetimes: Promise<unknown>[] = [];
    listeners.get('push')?.({
      data: { json: () => payload },
      waitUntil: (promise: Promise<unknown>) => lifetimes.push(promise),
    });
    await Promise.all(lifetimes);
  };

  const clickNotification = async (actionUrl: unknown) => {
    const lifetimes: Promise<unknown>[] = [];
    listeners.get('notificationclick')?.({
      action: 'view',
      notification: {
        close: () => undefined,
        data: { actionUrl },
      },
      waitUntil: (promise: Promise<unknown>) => lifetimes.push(promise),
    });
    await Promise.all(lifetimes);
  };

  return {
    activate,
    cacheNames: () => [...cacheStores.keys()],
    clickNotification,
    dispatchPush,
    fetchRequest,
    networkResponses,
    openedWindows,
    seedCache: (name: string) => caches.open(name),
    setUser,
    shownNotifications,
  };
};

describe('service worker runtime cache', () => {
  it('retires incompatible caches and preserves unrelated caches', async () => {
    const harness = createHarness();
    await Promise.all([
      harness.seedCache('seerrng-data-v1'),
      harness.seedCache('seerrng-data-v2'),
      harness.seedCache('runtime-v3'),
      harness.seedCache('third-party-cache'),
    ]);

    await harness.activate();

    assert.equal(harness.cacheNames().includes('seerrng-data-v1'), false);
    assert.equal(harness.cacheNames().includes('seerrng-data-v2'), true);
    assert.equal(harness.cacheNames().includes('runtime-v3'), false);
    assert.equal(harness.cacheNames().includes('third-party-cache'), true);
  });

  it('never intercepts mutations', async () => {
    const harness = createHarness();
    const response = await harness.fetchRequest(
      new Request('https://seerr.test/api/v1/request', { method: 'POST' })
    );

    assert.equal(response, undefined);
  });

  it('does not cache public settings with a no-store contract', async () => {
    const harness = createHarness();
    const response = await harness.fetchRequest(
      new Request('https://seerr.test/api/v1/settings/public')
    );

    assert.equal(response, undefined);
  });

  it('never classifies file-like API routes as shared static assets', async () => {
    const harness = createHarness();
    const response = await harness.fetchRequest(
      new Request('https://seerr.test/api/v1/user/export.json')
    );

    assert.equal(response, undefined);
  });

  it('does not override server policy for operational API responses', async () => {
    const harness = createHarness();

    for (const path of [
      '/api/v1/media?filter=allavailable',
      '/api/v1/request',
      '/api/v1/request/count',
    ]) {
      assert.equal(
        await harness.fetchRequest(new Request(`https://seerr.test${path}`)),
        undefined
      );
    }
  });

  it('honors Discover freshness headers before using cached data', async () => {
    const harness = createHarness();
    const request = new Request(
      'https://seerr.test/api/v1/discover/home/manifest'
    );

    await harness.setUser(1);
    harness.networkResponses.push(
      new Response('first', { headers: { 'X-Discover-Freshness': '0' } })
    );
    assert.equal(await (await harness.fetchRequest(request))?.text(), 'first');

    harness.networkResponses.push(new Response('second'));
    assert.equal(await (await harness.fetchRequest(request))?.text(), 'second');
  });

  it('never stores responses marked no-store', async () => {
    const harness = createHarness();
    const request = new Request(
      'https://seerr.test/api/v1/discover/home/state'
    );

    await harness.setUser(1);
    harness.networkResponses.push(
      new Response('private-state', {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    );
    assert.equal(
      await (await harness.fetchRequest(request))?.text(),
      'private-state'
    );

    harness.networkResponses.push(new Error('offline'));
    assert.notEqual(
      await (await harness.fetchRequest(request))?.text(),
      'private-state'
    );
  });

  it('revalidates responses marked no-cache before reuse', async () => {
    const harness = createHarness();
    const request = new Request('https://seerr.test/api/v1/discover/movies');

    await harness.setUser(1);
    harness.networkResponses.push(
      new Response('first', {
        headers: { 'Cache-Control': 'private, no-cache' },
      })
    );
    assert.equal(await (await harness.fetchRequest(request))?.text(), 'first');

    harness.networkResponses.push(new Response('second'));
    assert.equal(await (await harness.fetchRequest(request))?.text(), 'second');
  });

  it('isolates personalized data and retains stale data on network failure', async () => {
    const harness = createHarness();
    const request = new Request(
      'https://seerr.test/api/v1/discover/movies?sortBy=popularity'
    );

    await harness.setUser(1);
    harness.networkResponses.push(new Response('user-one'));
    assert.equal(
      await (await harness.fetchRequest(request))?.text(),
      'user-one'
    );

    await harness.setUser(2);
    harness.networkResponses.push(new Response('user-two'));
    assert.equal(
      await (await harness.fetchRequest(request))?.text(),
      'user-two'
    );

    await harness.setUser(1);
    harness.networkResponses.push(new Error('offline'));
    assert.equal(
      await (await harness.fetchRequest(request))?.text(),
      'user-one'
    );
  });

  it('does not reuse privileged data after permissions are revoked', async () => {
    const harness = createHarness();
    const request = new Request('https://seerr.test/api/v1/discover/movies');

    await harness.setUser(1, 2);
    harness.networkResponses.push(new Response('manager-data'));
    assert.equal(
      await (await harness.fetchRequest(request))?.text(),
      'manager-data'
    );

    await harness.setUser(1, 0);
    harness.networkResponses.push(new Error('offline'));
    const response = await harness.fetchRequest(request);
    assert.notEqual(await response?.text(), 'manager-data');
  });

  it('evicts fresh personalized data after an authorization failure', async () => {
    const harness = createHarness();
    const request = new Request('https://seerr.test/api/v1/discover/movies');

    await harness.setUser(1, 2);
    harness.networkResponses.push(new Response('manager-data'));
    assert.equal(
      await (await harness.fetchRequest(request))?.text(),
      'manager-data'
    );

    harness.networkResponses.push(new Response('forbidden', { status: 403 }));
    assert.equal(
      await (await harness.fetchRequest(request))?.text(),
      'manager-data'
    );

    harness.networkResponses.push(new Error('offline'));
    assert.notEqual(
      await (await harness.fetchRequest(request))?.text(),
      'manager-data'
    );
  });
});

describe('service worker notification actions', () => {
  it('offers navigation without state-changing approve or decline actions', async () => {
    const harness = createHarness();
    await harness.dispatchPush({
      notificationType: 'MEDIA_PENDING',
      subject: 'Request pending',
      message: 'Review request',
      requestId: 12,
      actionUrl: '/movie/42',
      actionUrlTitle: 'Review',
    });

    const options = harness.shownNotifications[0].options as {
      actions: { action: string }[];
      data: Record<string, unknown>;
    };
    assert.deepStrictEqual(JSON.parse(JSON.stringify(options.actions)), [
      { action: 'view', title: 'Review' },
    ]);
    assert.strictEqual('requestId' in options.data, false);
  });

  it('opens only validated same-origin paths and waits for navigation', async () => {
    const harness = createHarness();

    await harness.clickNotification('//evil.example/path');
    await harness.clickNotification('/movie/../settings');
    await harness.clickNotification('/movie/%2e%2e/settings');
    await harness.clickNotification('/movie\\..\\settings');
    await harness.clickNotification('/requests?filter=pending');

    assert.deepStrictEqual(harness.openedWindows, [
      'https://seerr.test/requests?filter=pending',
    ]);
  });
});
