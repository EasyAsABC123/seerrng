import { Permission } from '@server/lib/permissions';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SetupDefaults from './SetupDefaults';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

const settings = {
  defaultPermissions: Number(
    BigInt(Permission.REQUEST) |
      BigInt(Permission.REQUEST_4K) |
      BigInt(Permission.REQUEST_4K_TV) |
      BigInt(Permission.MANAGE_DOWNLOADS)
  ),
  enable4k: true,
  partialRequestsEnabled: true,
};

let dom: JSDOM;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/setup',
  });
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('HTMLButtonElement', dom.window.HTMLButtonElement);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(axios.post).mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  vi.unstubAllGlobals();
});

describe('SetupDefaults', () => {
  it('saves request defaults and continues while preserving unrelated permissions', async () => {
    const onContinue = vi.fn();
    vi.mocked(axios.post).mockResolvedValue({
      data: { ...settings, defaultPermissions: Permission.MANAGE_DOWNLOADS },
    } as never);

    await act(async () => {
      root.render(
        <IntlProvider locale="en">
          <SWRConfig
            value={{
              provider: () => new Map(),
              fallback: {
                '/api/v1/settings/main': settings,
              },
              revalidateOnMount: false,
              revalidateIfStale: false,
              revalidateOnFocus: false,
            }}
          >
            <SetupDefaults
              onBack={() => undefined}
              onContinue={onContinue}
              onSkip={() => undefined}
            />
          </SWRConfig>
        </IntlProvider>
      );
      await Promise.resolve();
    });

    const requestAccess = container.querySelector<HTMLButtonElement>(
      '[aria-label="Allow new users to request media"]'
    );
    expect(requestAccess?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => requestAccess?.click());
    expect(requestAccess?.getAttribute('aria-pressed')).toBe('false');

    const save = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save defaults and continue'
    );
    await act(async () => save?.click());

    expect(axios.post).toHaveBeenCalledWith('/api/v1/settings/main', {
      defaultPermissions: Permission.MANAGE_DOWNLOADS,
      enable4k: true,
      partialRequestsEnabled: true,
    });
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
