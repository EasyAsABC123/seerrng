import type { DownloadClientType } from '@server/lib/settings';

export type SetupDownloadProfile = 'usenet' | 'torrents' | 'both';

const USENET_CLIENT_TYPES: DownloadClientType[] = ['sabnzbd'];
const TORRENT_CLIENT_TYPES: DownloadClientType[] = [
  'qbittorrent',
  'transmission',
  'deluge',
  'torrentng',
  'rtorrent',
];

export const getSetupDownloadClientTypes = (
  profile: SetupDownloadProfile
): DownloadClientType[] => {
  if (profile === 'usenet') {
    return [...USENET_CLIENT_TYPES];
  }

  if (profile === 'torrents') {
    return [...TORRENT_CLIENT_TYPES];
  }

  return [...USENET_CLIENT_TYPES, ...TORRENT_CLIENT_TYPES];
};

export const getSetupDefaultDownloadClientTypes = (
  profile: SetupDownloadProfile
): DownloadClientType[] => {
  if (profile === 'usenet') {
    return ['sabnzbd'];
  }

  if (profile === 'torrents') {
    return ['qbittorrent'];
  }

  return ['sabnzbd', 'qbittorrent'];
};
