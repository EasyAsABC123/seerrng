import { describe, expect, it } from 'vitest';
import addReaderDeliveryKoboSyncJob from './0023_add_reader_delivery_kobo_sync_job';

describe('reader delivery Kobo sync job settings migration', () => {
  it('adds the regular sync schedule and preserves an operator schedule', () => {
    const defaults = addReaderDeliveryKoboSyncJob({
      jobs: {},
      migrations: [],
    });
    expect(defaults.jobs['reader-delivery-kobo-sync']).toEqual({
      schedule: '0 */15 * * * *',
    });

    const customized = addReaderDeliveryKoboSyncJob({
      jobs: {
        'reader-delivery-kobo-sync': {
          schedule: '0 30 * * * *',
          enabled: false,
        },
      },
      migrations: [],
    });
    expect(customized.jobs['reader-delivery-kobo-sync']).toEqual({
      schedule: '0 30 * * * *',
      enabled: false,
    });
  });

  it('does not reapply a recorded migration', () => {
    const migrated = {
      jobs: {},
      migrations: ['0023_add_reader_delivery_kobo_sync_job'],
    };
    expect(addReaderDeliveryKoboSyncJob(migrated)).toBe(migrated);
  });
});
