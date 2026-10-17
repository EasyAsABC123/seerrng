import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { SWRConfig, type Cache } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useDiscover from './useDiscover';

const state = vi.hoisted(() => ({
  settings: {
    currentSettings: { hideAvailable: false, hideBlocklisted: false },
  },
}));

vi.mock('./useSettings', () => ({ default: () => state.settings }));
vi.mock('./useUser', () => ({
  Permission: { MANAGE_BLOCKLIST: 'MANAGE_BLOCKLIST' },
  useUser: () => ({ user: { id: 1 }, hasPermission: () => false }),
}));
vi.mock('@app/hooks/useToasts', () => ({
  default: () => ({ addToast: vi.fn() }),
}));
vi.mock('next/router', () => ({
  useRouter: () => ({ asPath: '/discover/comics' }),
}));
vi.mock('@app/utils/discoverScrollRestoration', () => ({
  readDiscoverScrollEntry: () => undefined,
}));
vi.mock('@app/utils/swrCache', () => ({
  setPersistentResponse: vi.fn(),
  usePersistentResponse: () => undefined,
}));

let dom: JSDOM;
let root: Root;
let host: HTMLDivElement;
let cache: Cache;
let comicVineConfigured: boolean;
let fetchCount: number;

const ComicsProbe = () => {
  const discover = useDiscover<
    { id: number; mediaType: string },
    { comicVineConfigured?: boolean }
  >(
    '/api/v1/discover/comics',
    { query: '', publisher: '', startYear: '', minIssues: '', maxIssues: '' },
    { revalidateOnMount: true, dedupingInterval: 0 }
  );

  return (
    <>
      <output data-testid="configured">
        {String(discover.firstResultData?.comicVineConfigured)}
      </output>
      <output data-testid="validating">{String(discover.isValidating)}</output>
    </>
  );
};

const DefaultDiscoveryProbe = () => {
  useDiscover<{ id: number; mediaType: string }>('/api/v1/discover/movies', {
    query: '',
  });

  return <output data-testid="default-discovery">mounted</output>;
};

const renderProbe = (probe = <ComicsProbe />) =>
  root.render(
    <SWRConfig
      value={{
        provider: () => cache,
        fetcher: async () => {
          fetchCount += 1;
          return {
            page: 1,
            totalPages: 0,
            totalResults: 0,
            results: [],
            comicVineConfigured,
          };
        },
        revalidateOnFocus: false,
        dedupingInterval: 30_000,
      }}
    >
      <IntlProvider locale="en">{probe}</IntlProvider>
    </SWRConfig>
  );

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>');
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('navigator', dom.window.navigator);
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  cache = new Map();
  comicVineConfigured = false;
  fetchCount = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  vi.unstubAllGlobals();
});

describe('Discover SWR behavior', () => {
  it('fetches the first page when a discovery consumer uses default options', async () => {
    await act(async () => renderProbe(<DefaultDiscoveryProbe />));

    expect(fetchCount).toBe(1);
  });

  it('rechecks ComicVine configuration when returning after saving the key', async () => {
    await act(async () => renderProbe());
    expect(host.querySelector('[data-testid="configured"]')?.textContent).toBe(
      'false'
    );
    expect(fetchCount).toBe(1);

    await act(async () => root.render(null));
    comicVineConfigured = true;

    await act(async () => renderProbe());

    expect(fetchCount).toBe(2);
    expect(host.querySelector('[data-testid="configured"]')?.textContent).toBe(
      'true'
    );
  });
});
