import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { after, before } from 'node:test';

Reflect.set(
  globalThis,
  Symbol.for('seerrng.test.externalRuntimeConfig'),
  () => {
    const settings = getSettings();
    return {
      clientId: settings.clientId,
      vapidPublic: settings.vapidPublic,
      vapidPrivate: settings.vapidPrivate,
      main: settings.main,
      plex: settings.plex,
      jellyfin: settings.jellyfin,
      oidc: settings.oidc,
      tautulli: settings.tautulli,
      radarr: settings.radarr,
      sonarr: settings.sonarr,
      lidarr: settings.lidarr,
      readarr: settings.readarr,
      notifications: settings.notifications,
      network: settings.network,
    };
  }
);

before(() => {
  if (process.env.VERBOSE != 'true') logger.silent = true;
});

after(() => {
  if (process.env.VERBOSE != 'true') logger.silent = false;
});
