import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

describe('JSONEditor', () => {
  it('does not request the Ace worker script that the bundle never ships', () => {
    const source = readFileSync(resolve(__dirname, 'index.tsx'), 'utf8');
    assert.match(source, /setOptions=\{\{\s*useWorker:\s*false\s*\}\}/);
  });
});
