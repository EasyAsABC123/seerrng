import type { ProxySettings } from '@server/lib/settings';
import logger from '@server/logger';
import {
  isLocalOrPrivateAddress,
  requiresDirectSafeHttpConnection,
} from '@server/utils/security';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { Dispatcher } from 'undici';
import { Agent, ProxyAgent, setGlobalDispatcher } from 'undici';

export let requestInterceptorFunction: (
  config: InternalAxiosRequestConfig
) => InternalAxiosRequestConfig = (config) => config;

let axiosRequestInterceptorId: number | undefined;
let axiosProxyConfigured = false;
let fallbackHttpAgent: unknown;
let fallbackHttpsAgent: unknown;

const createDefaultAgent = (forceIpv4First?: boolean) =>
  new Agent({
    keepAliveTimeout: 5000,
    connections: 50,
    connect: forceIpv4First ? { family: 4 } : undefined,
  });

const clearAxiosProxyConfiguration = () => {
  if (axiosRequestInterceptorId !== undefined) {
    axios.interceptors.request.eject(axiosRequestInterceptorId);
    axiosRequestInterceptorId = undefined;
  }

  if (axiosProxyConfigured) {
    axios.defaults.httpAgent = fallbackHttpAgent;
    axios.defaults.httpsAgent = fallbackHttpsAgent;
    axiosProxyConfigured = false;
  }

  requestInterceptorFunction = (config) => config;
};

export const resetCustomProxyAgent = (forceIpv4First?: boolean): void => {
  clearAxiosProxyConfiguration();
  setGlobalDispatcher(createDefaultAgent(forceIpv4First));
};

export const PROXY_CONNECTIVITY_CHECK_OPTIONS = {
  timeout: 5_000,
  maxContentLength: 1024,
  maxBodyLength: 1024,
} as const;

const getAxiosRequestUrl = (
  config: InternalAxiosRequestConfig
): string | URL | undefined => {
  if (!config.url) {
    return config.baseURL;
  }

  try {
    return config.baseURL ? new URL(config.url, config.baseURL) : config.url;
  } catch {
    return config.url;
  }
};

const normalizeProxyHostname = (value: string): string =>
  value.trim().toLowerCase().replace(/\.+$/, '');

export const matchesProxyBypassFilter = (
  hostname: string,
  bypassFilter: string
): boolean => {
  const normalizedHostname = normalizeProxyHostname(hostname);
  if (!normalizedHostname) {
    return false;
  }

  return bypassFilter.split(',').some((address) => {
    const normalizedAddress = normalizeProxyHostname(address);
    if (!normalizedAddress) {
      return false;
    }

    if (normalizedAddress.startsWith('*')) {
      const suffix = normalizedAddress.slice(1).replace(/^\.+/, '');
      return Boolean(
        suffix &&
        (normalizedHostname === suffix ||
          normalizedHostname.endsWith(`.${suffix}`))
      );
    }

    return normalizedHostname === normalizedAddress;
  });
};

export default async function createCustomProxyAgent(
  proxySettings: ProxySettings,
  forceIpv4First?: boolean
) {
  if (!axiosProxyConfigured) {
    fallbackHttpAgent = axios.defaults.httpAgent;
    fallbackHttpsAgent = axios.defaults.httpsAgent;
  }
  clearAxiosProxyConfiguration();

  const defaultAgent = createDefaultAgent(forceIpv4First);

  const skipUrl = (url: string | URL) => {
    let hostname: string;
    try {
      hostname = typeof url === 'string' ? new URL(url).hostname : url.hostname;
    } catch {
      return false;
    }

    if (
      proxySettings.bypassLocalAddresses &&
      isLocalOrPrivateAddress(hostname)
    ) {
      return true;
    }

    if (matchesProxyBypassFilter(hostname, proxySettings.bypassFilter)) {
      return true;
    }

    return false;
  };

  const noProxyInterceptor = (
    dispatch: Dispatcher['dispatch']
  ): Dispatcher['dispatch'] => {
    return (opts, handler) => {
      return opts.origin && skipUrl(opts.origin)
        ? defaultAgent.dispatch(opts, handler)
        : dispatch(opts, handler);
    };
  };

  const token =
    proxySettings.user && proxySettings.password
      ? `Basic ${Buffer.from(
          `${proxySettings.user}:${proxySettings.password}`
        ).toString('base64')}`
      : undefined;

  try {
    const proxyUrl = `${proxySettings.useSsl ? 'https' : 'http'}://${
      proxySettings.hostname
    }:${proxySettings.port}`;
    const proxyAgent = new ProxyAgent({
      uri: proxyUrl,
      token,
      keepAliveTimeout: 5000,
      connections: 50,
      connect: forceIpv4First ? { family: 4 } : undefined,
    });

    setGlobalDispatcher(proxyAgent.compose(noProxyInterceptor));

    const agentOptions = {
      headers: token ? { 'proxy-authorization': token } : undefined,
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 5000,
      scheduling: 'lifo' as const,
      family: forceIpv4First ? 4 : undefined,
    };
    axios.defaults.httpAgent = new HttpProxyAgent(proxyUrl, agentOptions);
    axios.defaults.httpsAgent = new HttpsProxyAgent(proxyUrl, agentOptions);

    requestInterceptorFunction = (config) => {
      const url = getAxiosRequestUrl(config);
      const lookup = (
        config as InternalAxiosRequestConfig & { lookup?: unknown }
      ).lookup;
      if (requiresDirectSafeHttpConnection(lookup) || (url && skipUrl(url))) {
        config.httpAgent = false;
        config.httpsAgent = false;
        // Axios can independently honor HTTP_PROXY/HTTPS_PROXY after custom
        // agents are cleared. Disable that fallback as well.
        config.proxy = false;
      }
      return config;
    };
    axiosRequestInterceptorId = axios.interceptors.request.use(
      requestInterceptorFunction
    );
    axiosProxyConfigured = true;
  } catch (e) {
    logger.error('Failed to connect to the proxy: ' + e.message, {
      label: 'Proxy',
    });
    clearAxiosProxyConfiguration();
    setGlobalDispatcher(defaultAgent);
    return;
  }

  try {
    await axios.head(
      'https://www.google.com',
      PROXY_CONNECTIVITY_CHECK_OPTIONS
    );
    logger.debug('HTTP(S) proxy connected successfully', { label: 'Proxy' });
  } catch (e) {
    logger.error(
      'Failed to connect to the proxy: ' + e.message + ': ' + e.cause,
      { label: 'Proxy' }
    );
    clearAxiosProxyConfiguration();
    setGlobalDispatcher(defaultAgent);
  }
}
