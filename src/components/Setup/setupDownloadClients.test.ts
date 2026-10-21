import { describe, expect, it } from 'vitest';
import {
  getSetupDefaultDownloadClientTypes,
  getSetupDownloadClientTypes,
} from './setupDownloadClients';

describe('guided download client choices', () => {
  it('offers SABnzbd for Usenet progress', () => {
    expect(getSetupDownloadClientTypes('usenet')).toEqual(['sabnzbd']);
    expect(getSetupDefaultDownloadClientTypes('usenet')).toEqual(['sabnzbd']);
  });

  it('offers supported torrent clients', () => {
    expect(getSetupDownloadClientTypes('torrents')).toEqual([
      'qbittorrent',
      'transmission',
      'deluge',
      'torrentng',
      'rtorrent',
    ]);
    expect(getSetupDefaultDownloadClientTypes('torrents')).toEqual([
      'qbittorrent',
    ]);
  });

  it('starts both client types in a predictable order', () => {
    expect(getSetupDefaultDownloadClientTypes('both')).toEqual([
      'sabnzbd',
      'qbittorrent',
    ]);
    expect(getSetupDownloadClientTypes('both')).toHaveLength(6);
  });
});
