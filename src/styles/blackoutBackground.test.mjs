import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { styleContract } from './cssContract.mjs';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const themeContext = readFileSync(
  new URL('../context/ThemeContext.tsx', import.meta.url),
  'utf8'
);
const assertSolidTheme = (stylesheet) => {
  const palettes = [
    ...themeContext.matchAll(/\{\s*id: '([^']+)',([^{}]*?)\},/g),
  ];
  const seerr = palettes.filter(([, id]) => id === 'seerr');
  assert.equal(seerr.length, 1);
  assert.match(
    seerr[0][2],
    /primary: 'seerrBlue',[\s\S]*secondary: 'slate',[\s\S]*chrome: 'classic'/
  );
  assert.match(
    themeContext,
    /document\.documentElement\.dataset\.themePalette = themeTokens\.activePaletteId/
  );
  const palette = "[data-theme-palette='seerr']";
  const contract = styleContract(stylesheet);
  assert.equal(
    contract.declaration(':root', '--theme-page-spotlight-strength'),
    '0'
  );
  assert.equal(
    contract.declaration(palette, '--theme-page-spotlight-strength'),
    '0'
  );
  for (const property of ['center', 'edge'])
    assert.equal(
      contract.declaration(palette, '--theme-page-spotlight-' + property),
      undefined
    );
  for (const [stop, value] of Object.entries({
    light: '31 41 55',
    main: '40 68 120',
    deep: '17 24 39',
    black: '0 0 0',
  })) {
    assert.equal(
      contract.declaration(palette, '--theme-page-gradient-' + stop),
      value
    );
  }
  assert.equal(
    contract.declaration(palette, '--theme-page-gradient-main-stop'),
    '50%'
  );
  for (const [selector, property, value] of [
    ['.sidebar', 'background-color', 'rgb(var(--theme-sidebar-start))'],
    ['.app-backdrop', 'background-color', 'rgb(var(--theme-page-bg))'],
    [
      '.app-menu-gradient',
      'background-color',
      'rgb(var(--theme-overlay-menu))',
    ],
    [
      '.sidebar-link-selected',
      'background-color',
      'rgb(var(--theme-control-border))',
    ],
  ]) {
    assert.equal(contract.declaration(selector, property), value, selector);
    assert.doesNotMatch(
      contract.declaration(selector, 'background') ?? '',
      /gradient|radial/i,
      selector
    );
  }
  assert.equal(
    contract.declaration('.page-title', 'background-image'),
    undefined
  );
  assert.equal(
    contract.declaration('.page-title', 'color'),
    'rgb(var(--theme-heading-text))'
  );
};

test('the default theme uses solid slate surfaces and muted Seerr blue', () => {
  assertSolidTheme(css);
});

test('solid chrome check rejects a gradient reintroduced into the app backdrop', () => {
  assert.throws(
    () =>
      assertSolidTheme(
        css + '\n.app-backdrop { background: radial-gradient(white, black); }'
      ),
    assert.AssertionError
  );
});
