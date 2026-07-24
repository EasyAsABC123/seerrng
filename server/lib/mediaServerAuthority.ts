import { getSettings, type AllSettings } from '@server/lib/settings';
import { createHmac } from 'node:crypto';

type MediaServerAuthoritySettings = Pick<AllSettings, 'main' | 'jellyfin'>;

export const getJellyfinAuthAuthorityKey = (
  settings: MediaServerAuthoritySettings = getSettings()
): string =>
  createHmac('sha256', 'seerr-media-server-authority')
    .update(
      JSON.stringify([
        settings.main.mediaServerType,
        settings.main.mediaServerLogin ?? true,
        settings.jellyfin.ip,
        settings.jellyfin.port,
        settings.jellyfin.useSsl ?? false,
        settings.jellyfin.urlBase ?? '',
        settings.jellyfin.serverId,
        settings.jellyfin.apiKey,
      ])
    )
    .digest('hex');
