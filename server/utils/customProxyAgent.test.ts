import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { ProxySettings } from '@server/lib/settings';
import { createSafeHttpRequestOptions } from '@server/utils/security';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import createCustomProxyAgent, {
  PROXY_CONNECTIVITY_CHECK_OPTIONS,
  matchesProxyBypassFilter,
  requestInterceptorFunction,
  resetCustomProxyAgent,
} from './customProxyAgent';

const proxySettings: ProxySettings = {
  enabled: true,
  hostname: 'proxy.example.com',
  port: 8080,
  useSsl: false,
  user: '',
  password: '',
  bypassFilter: '',
  bypassLocalAddresses: true,
};

afterEach(() => {
  mock.restoreAll();
  resetCustomProxyAgent();
});

describe('requestInterceptorFunction', () => {
  it('matches wildcard proxy bypasses on DNS label boundaries', () => {
    const filter = '*.Internal.Example., exact.example';

    assert.equal(
      matchesProxyBypassFilter('service.internal.example', filter),
      true
    );
    assert.equal(matchesProxyBypassFilter('INTERNAL.EXAMPLE.', filter), true);
    assert.equal(matchesProxyBypassFilter('exact.example', filter), true);
    assert.equal(
      matchesProxyBypassFilter('evil-internal.example', filter),
      false
    );
    assert.equal(matchesProxyBypassFilter('notexact.example', filter), false);
    assert.equal(matchesProxyBypassFilter('example.com', '*'), false);
  });

  it('bounds the proxy connectivity probe', () => {
    assert.equal(PROXY_CONNECTIVITY_CHECK_OPTIONS.timeout, 5_000);
    assert.equal(PROXY_CONNECTIVITY_CHECK_OPTIONS.maxContentLength, 1024);
    assert.equal(PROXY_CONNECTIVITY_CHECK_OPTIONS.maxBodyLength, 1024);
  });

  it('is safe to register before proxy initialization', () => {
    const config = { url: 'https://example.com' } as InternalAxiosRequestConfig;

    assert.equal(requestInterceptorFunction(config), config);
  });

  it('bypasses the proxy for absolute local URLs even with a base URL', async () => {
    const head = mock.method(axios, 'head', async () => ({ status: 200 }));
    await createCustomProxyAgent(proxySettings);

    assert.equal(head.mock.callCount(), 1);
    assert.deepEqual(head.mock.calls[0].arguments, [
      'https://www.google.com',
      PROXY_CONNECTIVITY_CHECK_OPTIONS,
    ]);

    const config = requestInterceptorFunction({
      baseURL: 'https://api.example.com/v1',
      url: 'http://127.0.0.1/status',
    } as unknown as InternalAxiosRequestConfig);

    assert.equal(config.httpAgent, false);
    assert.equal(config.httpsAgent, false);
    assert.equal(config.proxy, false);
  });

  it('ejects the previous bypass policy when proxy settings change', async () => {
    const head = mock.method(axios, 'head', async () => ({ status: 200 }));
    const use = mock.method(
      axios.interceptors.request,
      'use',
      (() => 101) as typeof axios.interceptors.request.use
    );
    const eject = mock.method(axios.interceptors.request, 'eject');

    await createCustomProxyAgent({
      ...proxySettings,
      bypassFilter: '*.old-policy.example',
    });
    await createCustomProxyAgent({
      ...proxySettings,
      bypassLocalAddresses: false,
      bypassFilter: '',
    });

    assert.equal(head.mock.callCount(), 2);
    assert.equal(use.mock.callCount(), 2);
    assert.ok(
      eject.mock.calls.some((call) => call.arguments[0] === 101),
      'the prior interceptor was not ejected'
    );

    const config = requestInterceptorFunction({
      url: 'https://service.old-policy.example/status',
    } as unknown as InternalAxiosRequestConfig);
    assert.equal(config.httpAgent, undefined);
    assert.equal(config.httpsAgent, undefined);
  });

  it('bypasses the proxy for wildcard-filtered service hosts', async () => {
    mock.method(axios, 'head', async () => ({ status: 200 }));
    await createCustomProxyAgent({
      ...proxySettings,
      bypassLocalAddresses: false,
      bypassFilter: '*.internal.example',
    });

    const config = requestInterceptorFunction({
      url: 'https://books.internal.example/api/v1/status',
    } as InternalAxiosRequestConfig);
    assert.equal(config.httpAgent, false);
    assert.equal(config.httpsAgent, false);
    assert.equal(config.proxy, false);
  });

  it('keeps private-address-safe lookups direct', async () => {
    mock.method(axios, 'head', async () => ({ status: 200 }));
    await createCustomProxyAgent({
      ...proxySettings,
      bypassLocalAddresses: false,
    });

    const config = requestInterceptorFunction({
      url: 'https://webhook.example.com/notify',
      ...createSafeHttpRequestOptions(false, false, true),
    } as unknown as InternalAxiosRequestConfig);

    assert.equal(config.httpAgent, false);
    assert.equal(config.httpsAgent, false);
    assert.equal(config.proxy, false);
  });

  it('keeps explicitly direct lookups off the proxy when private addresses are allowed', async () => {
    mock.method(axios, 'head', async () => ({ status: 200 }));
    await createCustomProxyAgent({
      ...proxySettings,
      bypassLocalAddresses: false,
    });
    let allowPrivateAddresses = true;

    const config = requestInterceptorFunction({
      url: 'https://webhook.example.com/notify',
      ...createSafeHttpRequestOptions(() => allowPrivateAddresses, false, true),
    } as unknown as InternalAxiosRequestConfig);

    assert.equal(config.httpAgent, false);
    assert.equal(config.httpsAgent, false);
    assert.equal(config.proxy, false);

    allowPrivateAddresses = false;
    assert.equal(requestInterceptorFunction(config), config);
  });

  it('restores direct Axios agents when the proxy probe fails', async () => {
    mock.method(axios, 'head', async () => {
      throw new Error('proxy unavailable');
    });
    const use = mock.method(
      axios.interceptors.request,
      'use',
      (() => 202) as typeof axios.interceptors.request.use
    );
    const eject = mock.method(axios.interceptors.request, 'eject');

    await createCustomProxyAgent(proxySettings);

    assert.equal(use.mock.callCount(), 1);
    assert.ok(
      eject.mock.calls.some((call) => call.arguments[0] === 202),
      'the failed proxy interceptor was not ejected'
    );
    assert.equal(axios.defaults.httpAgent, undefined);
    assert.equal(axios.defaults.httpsAgent, undefined);

    const config = { url: 'https://example.com' } as InternalAxiosRequestConfig;
    assert.equal(requestInterceptorFunction(config), config);
  });
});
