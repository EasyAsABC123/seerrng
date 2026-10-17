import { Formik } from 'formik';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SettingsField from './SettingsField';

const savedHosts = [{ name: 'Docker host', hostname: '192.168.1.50' }];

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
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  vi.unstubAllGlobals();
});

it('fills a Formik hostname when an administrator selects a saved host', async () => {
  const onChange = vi.fn();

  await act(async () =>
    root.render(
      <IntlProvider locale="en">
        <SWRConfig
          value={{
            provider: () => new Map(),
            fallback: {
              '/api/v1/settings/connection-hosts': savedHosts,
            },
            revalidateIfStale: false,
            revalidateOnFocus: false,
          }}
        >
          <Formik initialValues={{ hostname: '' }} onSubmit={() => undefined}>
            <div className="form-input-field">
              <SettingsField
                id="hostname"
                name="hostname"
                type="text"
                onChange={onChange}
              />
            </div>
          </Formik>
        </SWRConfig>
      </IntlProvider>
    )
  );

  const trigger = container.querySelector('summary');
  expect(trigger?.textContent).toBe('Saved hosts');
  await act(async () => trigger?.click());
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        '[aria-label="Use saved host Docker host (192.168.1.50)"]'
      )
      ?.click()
  );

  expect(container.querySelector<HTMLInputElement>('#hostname')?.value).toBe(
    '192.168.1.50'
  );
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      target: expect.objectContaining({
        name: 'hostname',
        value: '192.168.1.50',
      }),
    })
  );
});

it('offers saved hosts for prefixed hostname fields too', async () => {
  await act(async () =>
    root.render(
      <IntlProvider locale="en">
        <SWRConfig
          value={{
            provider: () => new Map(),
            fallback: {
              '/api/v1/settings/connection-hosts': savedHosts,
            },
            revalidateIfStale: false,
            revalidateOnFocus: false,
          }}
        >
          <Formik
            initialValues={{ tautulliHostname: '' }}
            onSubmit={() => undefined}
          >
            <div>
              <SettingsField
                id="tautulliHostname"
                name="tautulliHostname"
                type="text"
              />
            </div>
          </Formik>
        </SWRConfig>
      </IntlProvider>
    )
  );

  expect(container.querySelector('summary')?.textContent).toBe('Saved hosts');
});
