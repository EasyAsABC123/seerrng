import type { AllSettings } from '@server/lib/settings';

type SettingsWithJobMigrations = {
  jobs?: Partial<AllSettings['jobs']>;
  migrations?: string[];
};

const addAdultScanJob = (settings: SettingsWithJobMigrations): AllSettings => {
  if (settings.migrations?.includes('0022_add_adult_scan_job')) {
    return settings as AllSettings;
  }

  settings.jobs ??= {};
  settings.jobs['adult-scan'] ??= { schedule: '0 45 5 * * *' };
  settings.migrations ??= [];
  settings.migrations.push('0022_add_adult_scan_job');
  return settings as AllSettings;
};

export default addAdultScanJob;
