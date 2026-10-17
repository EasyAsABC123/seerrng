#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!argument.startsWith('--')) {
    continue;
  }
  args.set(argument, process.argv[index + 1]);
  index += 1;
}

const currentPath = args.get('--current');
const existingPath = args.get('--existing');
const outputPath = args.get('--output');

if (!currentPath || !existingPath || !outputPath) {
  console.error(
    'Usage: prepend-changelog-section.mjs --current <file> --existing <file> --output <file>'
  );
  process.exit(2);
}

const releaseHeadingPattern = /^## (?!#).*$/gmu;
const current = fs.readFileSync(currentPath, 'utf8').trim();
const existing = fs.readFileSync(existingPath, 'utf8').trim();
const currentHeadingMatch = current.match(/^## (?!#).*$/mu);
const currentHeading = currentHeadingMatch?.[0];
const currentVersion = currentHeading?.match(
  /^## \[?v?(\d+\.\d+\.\d+)(?:\]|\s|$)/u
)?.[1];

if (!currentHeading || !currentVersion) {
  console.error(
    'Current changelog does not contain a versioned release section.'
  );
  process.exit(1);
}

// git-cliff includes the document title in every generated fragment. Keep the
// existing document title and insert only the release section to avoid
// accumulating duplicate `# Changelog` headings on retries.
const currentRelease = current.slice(currentHeadingMatch.index).trim();
const headings = [...existing.matchAll(releaseHeadingPattern)];
const firstExistingHeading = headings[0]?.index ?? existing.length;
let existingPrefix = existing.slice(0, firstExistingHeading).trimEnd();
let hasDocumentTitle = false;
existingPrefix = existingPrefix
  .split('\n')
  .filter((line) => {
    if (line !== '# Changelog') {
      return true;
    }
    if (hasDocumentTitle) {
      return false;
    }
    hasDocumentTitle = true;
    return true;
  })
  .join('\n')
  .replace(/\n{3,}/gu, '\n\n')
  .trimEnd();
const existingVersionHeading = headings.find((match) => {
  const version = match[0].match(/^## \[?v?(\d+\.\d+\.\d+)(?:\]|\s|$)/u)?.[1];
  return version === currentVersion;
});

let updated;
if (existingVersionHeading) {
  const existingVersionIndex = headings.indexOf(existingVersionHeading);
  const nextHeading = headings[existingVersionIndex + 1];
  const sectionEnd = nextHeading?.index ?? existing.length;
  const earlierReleaseHistory = existing
    .slice(firstExistingHeading, existingVersionHeading.index)
    .trim();
  const existingBeforeVersion = [existingPrefix, earlierReleaseHistory]
    .filter(Boolean)
    .join('\n\n');
  const existingAfterVersion = existing.slice(sectionEnd).trimStart();
  updated = [existingBeforeVersion, currentRelease, existingAfterVersion]
    .filter(Boolean)
    .join('\n\n');
} else {
  const existingReleaseHistory = existing
    .slice(firstExistingHeading)
    .trimStart();
  updated = [existingPrefix, currentRelease, existingReleaseHistory]
    .filter(Boolean)
    .join('\n\n');
}

fs.writeFileSync(outputPath, `${updated.trim()}\n`);
console.log(
  `${existingVersionHeading ? 'Updated' : 'Prepended'} changelog section for v${currentVersion}.`
);
