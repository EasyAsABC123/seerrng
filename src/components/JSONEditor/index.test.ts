import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('JSONEditor', () => {
  it('does not request the Ace worker script that the bundle never ships', () => {
    const source = readFileSync(
      new URL('./index.tsx', import.meta.url),
      'utf8'
    );
    assert.match(source, /setOptions=\{\{\s*useWorker:\s*false\s*\}\}/);
  });
});
