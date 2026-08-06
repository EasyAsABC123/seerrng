import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  changedReleaseNoteFiles,
  formatCuratedNotes,
  hasExplicitNoReleaseNote,
  injectCuratedNotes,
  parseReleaseNote,
  readReleaseNotes,
} from './release-notes.mjs';

const validContent = `---
category: fixed
---
Hardcover-backed book searches now keep working from cached metadata during a short upstream outage.`;

test('release-note fragments require a valid category and meaningful body', () => {
  const note = parseReleaseNote('release-notes/books.md', validContent);

  assert.deepEqual(note.errors, []);
  assert.equal(note.category, 'fixed');
  assert.match(note.body, /cached metadata/u);
});

test('release-note fragments reject placeholders and short text', () => {
  const note = parseReleaseNote(
    'release-notes/incomplete.md',
    '---\ncategory: changed\n---\nTODO'
  );

  assert.match(note.errors.join('\n'), /at least 20 characters/u);
  assert.match(note.errors.join('\n'), /placeholder/u);
});

test('release-note fragments reject unsupported metadata', () => {
  const note = parseReleaseNote(
    'release-notes/metadata.md',
    '---\ncategory: changed\nauthor: someone\n---\nThis metadata key should not be accepted in a release fragment.'
  );

  assert.match(note.errors.join('\n'), /not supported/u);
});

test('curated notes are grouped and inserted into the current release', () => {
  const note = parseReleaseNote('release-notes/books.md', validContent);
  const curated = formatCuratedNotes([note]);
  const changelog = injectCuratedNotes(
    '# Changelog\n\n## [3.12.0]\n\n### Bug Fixes\n',
    curated
  );

  assert.match(changelog, /## \[3\.12\.0\][\s\S]*### User-facing changes/u);
  assert.match(changelog, /#### Fixed[\s\S]*cached metadata/u);
});

test('internal-only work has an explicit opt-out marker', () => {
  assert.equal(hasExplicitNoReleaseNote('release-note: none'), true);
  assert.equal(
    hasExplicitNoReleaseNote(
      '- [x] This change is internal-only and does not need a user-facing release note.'
    ),
    true
  );
  assert.equal(hasExplicitNoReleaseNote('No release details yet.'), false);
});

test('release-note range discovery distinguishes additions from edits', () => {
  const repository = fs.mkdtempSync(
    path.join(os.tmpdir(), 'seerrng-release-notes-')
  );
  const runGit = (...args) =>
    execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();

  try {
    runGit('init', '--initial-branch=main', '--quiet');
    runGit('config', 'user.name', 'Release Notes Test');
    runGit('config', 'user.email', 'release-notes@example.invalid');
    fs.mkdirSync(path.join(repository, 'release-notes'));
    fs.writeFileSync(
      path.join(repository, 'release-notes', 'README.md'),
      '# Release notes\n'
    );
    runGit('add', '.');
    runGit('commit', '--quiet', '-m', 'chore: initialize test repository');
    const base = runGit('rev-parse', 'HEAD');

    const fragment = path.join(repository, 'release-notes', 'books.md');
    fs.writeFileSync(fragment, validContent);
    runGit('add', '.');
    runGit('commit', '--quiet', '-m', 'feat: add book compatibility');
    const firstHead = runGit('rev-parse', 'HEAD');

    const additions = changedReleaseNoteFiles(base, firstHead, repository);
    assert.deepEqual(additions, [
      { status: 'A', file: 'release-notes/books.md' },
    ]);
    assert.deepEqual(readReleaseNotes(additions, repository).errors, []);

    fs.writeFileSync(fragment, `${validContent}\n`);
    runGit('add', '.');
    runGit('commit', '--quiet', '-m', 'fix: refine release note');
    const secondHead = runGit('rev-parse', 'HEAD');
    assert.deepEqual(
      changedReleaseNoteFiles(firstHead, secondHead, repository),
      [{ status: 'M', file: 'release-notes/books.md' }]
    );
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
});
