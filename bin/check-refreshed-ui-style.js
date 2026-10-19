#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-console -- CommonJS command-line validator. */

const fs = require('node:fs');
const path = require('node:path');
const {
  validateRefreshedUiStyleBoundaries,
} = require('./check-refreshed-ui-style-lib.js');

const root = path.resolve(__dirname, '..');
const componentRoot = path.join(root, 'src', 'components');
const collectTsxFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(fullPath);
    return entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
const componentFiles = Object.fromEntries(
  collectTsxFiles(componentRoot).map((fullPath) => [
    path.relative(root, fullPath).split(path.sep).join('/'),
    fs.readFileSync(fullPath, 'utf8'),
  ])
);
// globals.css pulls split-out role families in with relative @import rules
// (for example crossMedia.css); their definitions count as global CSS.
const stylesDirectory = path.join(root, 'src', 'styles');
const globalCss = fs.readFileSync(
  path.join(stylesDirectory, 'globals.css'),
  'utf8'
);
const importedCss = Array.from(
  globalCss.matchAll(/^@import\s+['"](\.\/[^'"]+\.css)['"];/gm),
  (match) => fs.readFileSync(path.join(stylesDirectory, match[1]), 'utf8')
);
const files = {
  ...componentFiles,
  'src/styles/globals.css': [globalCss, ...importedCss].join('\n'),
};
const { errors, scopedFileCount } = validateRefreshedUiStyleBoundaries(files);

if (errors.length > 0) {
  console.error('UI shared-style reference check failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `UI shared-style reference check passed (${Object.keys(componentFiles).length} components scanned, ${scopedFileCount} components inspected, shared stylesheet references verified).`
  );
}
