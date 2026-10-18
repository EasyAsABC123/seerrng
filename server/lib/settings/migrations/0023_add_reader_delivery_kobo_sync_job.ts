import type { AllSettings } from '@server/lib/settings';

type SettingsWithJobMigrations = {
  jobs?: Partial<AllSettings['jobs']>;
  migrations?: string[];
};

const addReaderDeliveryKoboSyncJob = (
  settings: SettingsWithJobMigrations
): AllSettings => {
  if (settings.migrations?.includes('0023_add_reader_delivery_kobo_sync_job')) {
    return settings as AllSettings;
  }

  settings.jobs ??= {};
  settings.jobs['reader-delivery-kobo-sync'] ??= {
    schedule: '0 */15 * * * *',
  };
  settings.migrations ??= [];
  settings.migrations.push('0023_add_reader_delivery_kobo_sync_job');
  return settings as AllSettings;
};

export default addReaderDeliveryKoboSyncJob;
