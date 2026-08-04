import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deduplicateRecoveryQueue } from './downloadRecovery';

describe('deduplicateRecoveryQueue', () => {
  it('keeps one recovery item per download ID', () => {
    const first = { id: 1, downloadId: 'download-1', status: 'queued' };
    const duplicate = {
      id: 2,
      downloadId: 'download-1',
      status: 'warning',
    };
    const second = { id: 3, downloadId: 'download-2', status: 'queued' };

    assert.deepEqual(deduplicateRecoveryQueue([first, duplicate, second]), [
      first,
      second,
    ]);
  });

  it('does not deduplicate items without a download ID', () => {
    const first = { id: 1, status: 'queued', downloadId: undefined };
    const second = { id: 2, status: 'queued', downloadId: undefined };

    assert.deepEqual(deduplicateRecoveryQueue([first, second]), [
      first,
      second,
    ]);
  });
});
