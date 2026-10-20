import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'react-intl';
import { beforeEach, expect, it, vi } from 'vitest';
import { EditionCardPicker, SeriesNarratorPlanner } from './index';

const state = vi.hoisted(() => ({
  error: undefined as Error | undefined,
  mutate: vi.fn(),
}));

vi.mock('swr', () => ({
  default: () => ({
    data: undefined,
    error: state.error,
    mutate: state.mutate,
  }),
}));
vi.mock('@app/components/Common/Badge', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock('@app/components/Common/Button', () => ({
  default: ({
    children,
    type,
    onClick,
  }: {
    children: React.ReactNode;
    type?: 'button';
    onClick?: () => void;
  }) => (
    <button type={type} onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('@app/components/Common/CoverImage', () => ({ default: () => null }));
vi.mock('@app/components/Common/LoadingSpinner', () => ({
  default: () => null,
}));
vi.mock('@app/components/Following/FollowButton', () => ({
  default: () => null,
}));
vi.mock('@app/hooks/useToasts', () => ({
  default: () => ({ addToast: vi.fn() }),
}));
vi.mock('@app/hooks/useUser', () => ({
  Permission: {
    REQUEST_ADVANCED: 'request_advanced',
    MANAGE_REQUESTS: 'manage_requests',
  },
  useUser: () => ({ hasPermission: () => false }),
}));

beforeEach(() => {
  vi.stubGlobal('React', React);
  state.error = undefined;
  state.mutate.mockReset();
});

const render = (children: React.ReactNode) =>
  renderToStaticMarkup(<IntlProvider locale="en">{children}</IntlProvider>);

it('explains an edition comparison failure and offers retry', () => {
  state.error = new Error('Forbidden');

  const html = render(
    <EditionCardPicker
      format="audiobook"
      title="The Long Series Name"
      value={{ policy: 'only' }}
      onChange={() => undefined}
    />
  );

  expect(html).toContain('role="alert"');
  expect(html).toContain(
    'You can still submit this request without choosing a version.'
  );
  expect(html).toContain('>Retry</button>');
});

it('explains a narrator comparison failure and offers retry', () => {
  state.error = new Error('Forbidden');

  const html = render(
    <SeriesNarratorPlanner title="The Long Series Name" authorId={21} />
  );

  expect(html).toContain('role="alert"');
  expect(html).toContain('You can still request individual books.');
  expect(html).toContain('>Retry</button>');
});
