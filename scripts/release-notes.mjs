#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const RELEASE_NOTE_DIRECTORY = 'release-notes';

const CATEGORIES = new Map([
  ['added', 'Added'],
  ['changed', 'Changed'],
  ['fixed', 'Fixed'],
  ['security', 'Security'],
  ['removed', 'Removed'],
  ['deprecated', 'Deprecated'],
]);

const isReleaseNotePath = (file) =>
  file.startsWith(`${RELEASE_NOTE_DIRECTORY}/`) &&
  file.endsWith('.md') &&
  path.posix.dirname(file) === RELEASE_NOTE_DIRECTORY &&
  path.posix.basename(file).toLowerCase() !== 'readme.md';

export const isReleaseNoteFile = isReleaseNotePath;

export function parseReleaseNote(file, content) {
  const errors = [];
  const normalized = content.replace(/\r\n?/gu, '\n');
  const frontmatter = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u);

  if (!frontmatter) {
    return {
      file,
      errors: ['must contain YAML frontmatter delimited by `---`'],
    };
  }

  const metadata = new Map();
  for (const line of frontmatter[1].split('\n')) {
    if (!line.trim()) {
      continue;
    }

    const match = line.match(/^([a-z][a-z-]*):\s*(\S.*)$/u);
    if (!match) {
      errors.push(`has invalid frontmatter: ${line}`);
      continue;
    }

    if (metadata.has(match[1])) {
      errors.push(`declares frontmatter key "${match[1]}" more than once`);
    }
    metadata.set(match[1], match[2].trim());
  }

  for (const key of metadata.keys()) {
    if (key !== 'category') {
      errors.push(`frontmatter key "${key}" is not supported`);
    }
  }

  const category = metadata.get('category')?.toLowerCase();
  if (!category || !CATEGORIES.has(category)) {
    errors.push(
      `category must be one of: ${[...CATEGORIES.keys()].join(', ')}`
    );
  }

  const body = frontmatter[2].trim().replace(/\s+/gu, ' ');
  if (body.length < 20) {
    errors.push(
      'body must be at least 20 characters and describe the user impact'
    );
  }
  if (/<!--|-->|\b(?:todo|tbd|fill in)\b/iu.test(body)) {
    errors.push('body contains a placeholder or HTML comment');
  }

  return {
    file,
    category,
    categoryTitle: CATEGORIES.get(category),
    body,
    errors,
  };
}

export function changedReleaseNoteFiles(base, head, cwd = process.cwd()) {
  const output = execFileSync(
    'git',
    [
      'diff',
      '--name-status',
      '--find-renames',
      base,
      head,
      '--',
      RELEASE_NOTE_DIRECTORY,
    ],
    { cwd, encoding: 'utf8' }
  );

  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const columns = line.split('\t');
      const status = columns[0] ?? '';
      const file = status.startsWith('R') ? columns[2] : columns[1];
      return { status: status.charAt(0), file };
    })
    .filter(({ file }) => file && isReleaseNotePath(file));
}

export function readReleaseNotes(entries, cwd = process.cwd()) {
  const notes = [];
  const errors = [];

  for (const entry of entries) {
    const filePath = path.join(cwd, entry.file);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      errors.push(`${entry.file}: unable to read file (${error.message})`);
      continue;
    }

    const note = parseReleaseNote(entry.file, content);
    if (note.errors.length > 0) {
      errors.push(...note.errors.map((error) => `${entry.file}: ${error}`));
    } else {
      notes.push(note);
    }
  }

  return { notes, errors };
}

export function formatCuratedNotes(notes) {
  if (notes.length === 0) {
    return '';
  }

  const lines = ['### User-facing changes', ''];
  for (const [category, title] of CATEGORIES) {
    const categoryNotes = notes.filter((note) => note.category === category);
    if (categoryNotes.length === 0) {
      continue;
    }

    lines.push(`#### ${title}`, '');
    for (const note of categoryNotes) {
      lines.push(`- ${note.body}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function injectCuratedNotes(changelog, curatedNotes) {
  if (!curatedNotes) {
    return changelog;
  }

  const heading = /^## .+$/mu.exec(changelog);
  if (!heading || heading.index === undefined) {
    return `${curatedNotes}\n\n${changelog.trim()}\n`;
  }

  const insertionPoint = heading.index + heading[0].length;
  return `${changelog.slice(0, insertionPoint)}\n\n${curatedNotes}\n${changelog.slice(insertionPoint).replace(/^\n*/u, '\n')}`;
}

export function hasExplicitNoReleaseNote(body) {
  return (
    /release-note\s*:\s*none/iu.test(body) ||
    /-\s*\[x\][^\n]*(?:internal-only|no user-facing release note)/iu.test(body)
  );
}
