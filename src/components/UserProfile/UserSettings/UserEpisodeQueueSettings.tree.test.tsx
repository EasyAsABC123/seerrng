import axios from 'axios';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type * as ReactIntl from 'react-intl';
import { afterEach, expect, it, vi } from 'vitest';
import UserEpisodeQueueSettings from './UserEpisodeQueueSettings';

const fixtureState = vi.hoisted(() => ({
  canManageUsers: false,
  targetUserId: '17',
  mutate: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('next/router', () => ({
  useRouter: () => ({ query: { userId: fixtureState.targetUserId } }),
}));
vi.mock('@app/hooks/useUser', () => ({
  Permission: { MANAGE_USERS: 8 },
  useUser: () => ({
    user: { id: 7 },
    hasPermission: () => fixtureState.canManageUsers,
  }),
}));
vi.mock('@app/hooks/useToasts', () => ({
  default: () => ({ addToast: fixtureState.addToast }),
}));
vi.mock('swr', () => ({
  default: (key: string | null) => ({
    data: key ? { status: 'approved', defaultEpisodeCount: 2 } : undefined,
    error: undefined,
    mutate: fixtureState.mutate,
  }),
  mutate: fixtureState.mutate,
}));
vi.mock('react-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactIntl>()),
  useIntl: () => ({
    formatMessage: (
      { defaultMessage }: { defaultMessage: string },
      values?: Record<string, unknown>
    ) =>
      defaultMessage
        .replace(
          /\{(\w+), plural, one \{([^{}]*)\} other \{([^{}]*)\}\}/g,
          (_match, key, one, other) =>
            String(values?.[key]) === '1'
              ? one.replace('#', String(values?.[key]))
              : other.replace('#', String(values?.[key]))
        )
        .replace(/\{([^}]+)\}/g, (placeholder, key) =>
          values?.[key] === undefined ? placeholder : String(values[key])
        ),
  }),
}));
vi.mock('@app/components/Common/Alert', () => ({
  default: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));
vi.mock('@app/components/Common/Badge', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock('@app/components/Common/Button', () => ({
  default: ({
    children,
    onClick,
    disabled,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
vi.mock('@app/components/Common/LoadingSpinner', () => ({
  default: () => <div>Loading</div>,
}));
vi.mock('@app/components/Common/Modal', () => ({
  default: ({
    children,
    onOk,
    okText,
  }: {
    children: React.ReactNode;
    onOk: () => void;
    okText: string;
  }) => (
    <div role="dialog">
      {children}
      <button type="button" data-testid="confirm" onClick={onOk}>
        {okText}
      </button>
    </div>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixtureState.canManageUsers = false;
});

async function fixture(run: (doc: Document) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>');
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(<UserEpisodeQueueSettings />));
    await run(document);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
}

async function click(doc: Document, selector: string) {
  const button = doc.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Missing button ${selector}`);
  await act(async () => button.click());
}

it('does not expose a request or setting control to end users, including on a direct URL', async () => {
  fixtureState.canManageUsers = false;

  await fixture(async (doc) => {
    expect(doc.body.textContent).toContain(
      'Episode Queue is managed by your server administrator from each user’s profile.'
    );
    expect(doc.querySelector('select')).toBeNull();
    expect(doc.querySelector('button')).toBeNull();
    expect(doc.body.textContent).not.toContain('Waiting for approval');
    expect(doc.body.textContent).not.toContain('Request access');
  });
});

it('lets a user manager set the selected user’s account-wide default after confirmation', async () => {
  fixtureState.canManageUsers = true;
  vi.mocked(axios.post).mockResolvedValue({
    data: { status: 'approved', defaultEpisodeCount: 4 },
  });

  await fixture(async (doc) => {
    const select = doc.querySelector<HTMLSelectElement>(
      '#episode-queue-default-count'
    );
    expect(select?.value).toBe('2');
    await act(async () => {
      select!.value = '4';
      select!.dispatchEvent(
        new doc.defaultView!.Event('change', { bubbles: true })
      );
    });
    await click(doc, 'button:not([data-testid="confirm"])');
    expect(doc.querySelector('[role="dialog"]')?.textContent).toContain(
      'This will keep 4 episodes queued ahead on all of this user’s existing and future interactive TV requests.'
    );
    await click(doc, '[data-testid="confirm"]');
    expect(axios.post).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/user/17/settings/episode-queue',
      { defaultEpisodeCount: 4 }
    );
  });
});
