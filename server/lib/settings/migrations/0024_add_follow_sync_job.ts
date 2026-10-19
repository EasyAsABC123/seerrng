import type { AllSettings } from '@server/lib/settings';

type SettingsWithJobMigrations = {
  jobs?: Partial<AllSettings['jobs']>;
  migrations?: string[];
};

const addFollowSyncJob = (settings: SettingsWithJobMigrations): AllSettings => {
  if (settings.migrations?.includes('0024_add_follow_sync_job')) {
    return settings as AllSettings;
  }

  settings.jobs ??= {};
  settings.jobs['follow-sync'] ??= {
    schedule: '0 */30 * * * *',
  };
  settings.migrations ??= [];
  settings.migrations.push('0024_add_follow_sync_job');
  return settings as AllSettings;
};

export default addFollowSyncJob;
