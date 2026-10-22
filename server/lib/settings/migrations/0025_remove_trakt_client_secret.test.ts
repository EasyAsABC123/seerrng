import { describe, expect, it } from 'vitest';
import removeTraktClientSecret from './0025_remove_trakt_client_secret';

describe('Trakt client secret settings migration', () => {
  it('removes the obsolete secret and preserves the remaining integration settings', () => {
    const settings = {
      discoveryIntegrations: {
        trakt: { clientId: 'trakt-app', clientSecret: 'obsolete-secret' },
        anilist: { clientId: 'anilist-app', clientSecret: 'anilist-secret' },
      },
      migrations: [],
    };

    const migrated = removeTraktClientSecret(settings);

    expect(migrated.discoveryIntegrations.trakt).toEqual({
      clientId: 'trakt-app',
    });
    expect(migrated.discoveryIntegrations.anilist.clientSecret).toBe(
      'anilist-secret'
    );
    expect(migrated.migrations).toContain('0025_remove_trakt_client_secret');
  });

  it('does not add the migration twice', () => {
    const settings = {
      discoveryIntegrations: {
        trakt: { clientId: 'trakt-app' },
      },
      migrations: ['0025_remove_trakt_client_secret'],
    };

    expect(removeTraktClientSecret(settings).migrations).toEqual([
      '0025_remove_trakt_client_secret',
    ]);
  });
});
