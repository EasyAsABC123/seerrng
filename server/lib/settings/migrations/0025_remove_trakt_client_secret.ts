import type { AllSettings } from '@server/lib/settings';

const MIGRATION_NAME = '0025_remove_trakt_client_secret';

type SettingsWithLegacyTraktSecret = Partial<AllSettings> & {
  discoveryIntegrations?: Omit<
    Partial<AllSettings['discoveryIntegrations']>,
    'trakt'
  > & {
    trakt?: AllSettings['discoveryIntegrations']['trakt'] & {
      clientSecret?: string;
    };
  };
};

const removeTraktClientSecret = (
  settings: SettingsWithLegacyTraktSecret
): AllSettings => {
  const migrations = settings.migrations ?? (settings.migrations = []);
  const trakt = settings.discoveryIntegrations?.trakt;
  if (trakt) delete trakt.clientSecret;
  if (!migrations.includes(MIGRATION_NAME)) migrations.push(MIGRATION_NAME);
  return settings as AllSettings;
};

export default removeTraktClientSecret;
