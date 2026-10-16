import type * as FormikTypes from 'formik';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SportarrModal from './index';

const state = vi.hoisted(() => ({
  post: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('axios', () => ({ default: { post: state.post } }));
vi.mock('@app/hooks/useToasts', () => ({
  default: () => ({ addToast: state.toast }),
}));
vi.mock('@app/components/Common/Modal', async () => {
  const formik = await vi.importActual<typeof FormikTypes>('formik');
  type Values = {
    name: string;
    hostname: string;
    port: number;
    useSsl: boolean;
    baseUrl: string;
    apiKey: string;
    activeProfileId: number | '';
    activeProfileName: string;
    isDefault: boolean;
    externalUrl: string;
  };
  return {
    default: ({
      children,
      onSecondary,
      secondaryDisabled,
      secondaryText,
    }: {
      children: React.ReactNode;
      onSecondary: () => void;
      secondaryDisabled: boolean;
      secondaryText: string;
    }) => {
      const { values, isValid, errors, setValues } =
        formik.useFormikContext<Values>();
      return (
        <div role="dialog">
          <output data-testid="formik-debug">
            {JSON.stringify({ values, isValid, errors })}
          </output>
          <button
            type="button"
            data-testid="fill-connection-details"
            onClick={() =>
              void setValues({
                ...values,
                hostname: 'sportarr.example',
                apiKey: 'test-api-key',
              })
            }
          >
            Fill connection details
          </button>
          <button
            type="button"
            data-testid="test-connection"
            disabled={secondaryDisabled}
            onClick={onSecondary}
          >
            {secondaryText}
          </button>
          {children}
        </div>
      );
    },
  };
});

let dom: JSDOM;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/settings/services',
  });
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('HTMLButtonElement', dom.window.HTMLButtonElement);
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  state.post.mockResolvedValue({
    data: { profiles: [{ id: 12, name: 'HD' }] },
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  vi.unstubAllGlobals();
});

const render = async () => {
  await act(async () =>
    root.render(
      <IntlProvider locale="en">
        <SportarrModal
          settings={null}
          onClose={() => undefined}
          onSave={() => undefined}
        />
      </IntlProvider>
    )
  );
};

it('lets an administrator test Sportarr before choosing the profile that test loads', async () => {
  await render();
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>(
        '[data-testid="fill-connection-details"]'
      )
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const formState = JSON.parse(
    container.querySelector('[data-testid="formik-debug"]')?.textContent ?? '{}'
  );
  expect(formState.values).toMatchObject({
    hostname: 'sportarr.example',
    apiKey: 'test-api-key',
    activeProfileId: '',
  });
  expect(formState.isValid).toBe(false);

  const testButton = container.querySelector<HTMLButtonElement>(
    '[data-testid="test-connection"]'
  );
  expect(testButton?.disabled).toBe(false);

  await act(async () => testButton?.click());

  expect(state.post).toHaveBeenCalledWith('/api/v1/settings/sportarr/test', {
    hostname: 'sportarr.example',
    port: 1867,
    useSsl: false,
    baseUrl: '',
    apiKey: 'test-api-key',
  });
  expect(
    container.querySelector<HTMLSelectElement>('#activeProfileId')?.textContent
  ).toContain('HD');
});
