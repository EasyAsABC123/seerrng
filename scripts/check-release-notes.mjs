#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';

import {
  changedReleaseNoteFiles,
  hasExplicitNoReleaseNote,
  readReleaseNotes,
} from './release-notes.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!argument.startsWith('--')) {
    continue;
  }
  args.set(argument, process.argv[index + 1]);
  index += 1;
}

const base = args.get('--base');
const head = args.get('--head');
const bodyFile = args.get('--pr-body');

if (!base || !head || !bodyFile) {
  console.error(
    'Usage: check-release-notes.mjs --base <sha> --head <sha> --pr-body <file>'
  );
  process.exit(2);
}

const entries = changedReleaseNoteFiles(base, head);
const modified = entries.filter((entry) => entry.status !== 'A');
const { notes, errors } = readReleaseNotes(
  entries.filter((entry) => entry.status === 'A')
);
const body = fs.readFileSync(bodyFile, 'utf8');
const explicitNoReleaseNote = hasExplicitNoReleaseNote(body);
const issues = [...errors];

for (const entry of modified) {
  issues.push(
    `${entry.file}: release-note fragments are append-only; add a new fragment instead of modifying an old one`
  );
}

if (notes.length === 0 && !explicitNoReleaseNote) {
  issues.push(
    'add a validated file under release-notes/ or explicitly mark the PR `release-note: none` for internal-only work'
  );
}

if (notes.length > 0 && explicitNoReleaseNote) {
  issues.push(
    'choose either a release-note fragment or `release-note: none`; do not select both'
  );
}

if (issues.length > 0) {
  console.error('Release-note validation failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  notes.length > 0
    ? `Validated ${notes.length} user-facing release-note fragment(s).`
    : 'Explicitly marked as internal-only; no release note required.'
);
