import LidarrAPI from '@server/api/servarr/lidarr';
import RadarrAPI from '@server/api/servarr/radarr';
import ReadarrAPI from '@server/api/servarr/readarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaType } from '@server/constants/media';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { uniqWith } from 'lodash';

interface EpisodeNumberResult {
  seasonNumber: number;
  episodeNumber: number;
  absoluteEpisodeNumber: number;
  id: number;
}

export const isMatchingReadarrDownloadServer = (
  serverA: {
    hostname: string;
    port: number;
    baseUrl?: string;
    serviceType?: 'ebook' | 'audiobook';
  },
  serverB: {
    hostname: string;
    port: number;
    baseUrl?: string;
    serviceType?: 'ebook' | 'audiobook';
  }
): boolean =>
  serverA.hostname === serverB.hostname &&
  serverA.port === serverB.port &&
  serverA.baseUrl === serverB.baseUrl &&
  (serverA.serviceType ?? 'ebook') === (serverB.serviceType ?? 'ebook');

export interface DownloadingItem {
  mediaType: MediaType;
  externalId: number;
  size: number;
  sizeLeft: number;
  status: string;
  timeLeft: string;
  estimatedCompletionTime: Date;
  title: string;
  downloadId: string;
  episode?: EpisodeNumberResult;
}

class DownloadTracker {
  private static readonly monitoredRefreshCooldownMs = 5 * 60 * 1000;

  private radarrServers: Record<number, DownloadingItem[]> = {};
  private sonarrServers: Record<number, DownloadingItem[]> = {};
  private lidarrServers: Record<number, DownloadingItem[]> = {};
  private readarrServers: Record<number, DownloadingItem[]> = {};
  private monitoredRefreshes = new Set<string>();
  private lastMonitoredRefresh = new Map<string, number>();

  private refreshMonitoredDownloads(
    key: string,
    refresh: () => Promise<void>,
    serverName: string
  ): void {
    const lastRefresh = this.lastMonitoredRefresh.get(key) ?? 0;

    if (Date.now() - lastRefresh < DownloadTracker.monitoredRefreshCooldownMs) {
      return;
    }

    if (this.monitoredRefreshes.has(key)) {
      return;
    }

    this.monitoredRefreshes.add(key);
    this.lastMonitoredRefresh.set(key, Date.now());
    refresh()
      .catch((e) => {
        logger.debug(
          `Unable to refresh monitored downloads for server: ${serverName}`,
          {
            errorMessage: e instanceof Error ? e.message : String(e),
            label: 'Download Tracker',
          }
        );
      })
      .finally(() => {
        this.monitoredRefreshes.delete(key);
      });
  }

  public getMovieProgress(
    serverId: number,
    externalServiceId: number
  ): DownloadingItem[] {
    if (!this.radarrServers[serverId]) {
      return [];
    }

    return this.radarrServers[serverId].filter(
      (item) => item.externalId === externalServiceId
    );
  }

  public getSeriesProgress(
    serverId: number,
    externalServiceId: number
  ): DownloadingItem[] {
    if (!this.sonarrServers[serverId]) {
      return [];
    }

    return this.sonarrServers[serverId].filter(
      (item) => item.externalId === externalServiceId
    );
  }

  public getMusicProgress(
    serverId: number,
    externalServiceId: number
  ): DownloadingItem[] {
    if (!this.lidarrServers[serverId]) {
      return [];
    }

    return this.lidarrServers[serverId].filter(
      (item) => item.externalId === externalServiceId
    );
  }

  public getBookProgress(
    serverId: number,
    externalServiceId: number
  ): DownloadingItem[] {
    if (!this.readarrServers[serverId]) {
      return [];
    }

    return this.readarrServers[serverId].filter(
      (item) => item.externalId === externalServiceId
    );
  }

  public async resetDownloadTracker() {
    this.radarrServers = {};
    this.sonarrServers = {};
    this.lidarrServers = {};
    this.readarrServers = {};
  }

  public async updateDownloads() {
    await Promise.all([
      this.updateRadarrDownloads(),
      this.updateSonarrDownloads(),
      this.updateLidarrDownloads(),
      this.updateReadarrDownloads(),
    ]);
  }

  private async updateRadarrDownloads() {
    const settings = getSettings();

    // Remove duplicate servers
    const filteredServers = uniqWith(settings.radarr, (radarrA, radarrB) => {
      return (
        radarrA.hostname === radarrB.hostname &&
        radarrA.port === radarrB.port &&
        radarrA.baseUrl === radarrB.baseUrl
      );
    });

    // Load downloads from Radarr servers
    await Promise.all(
      filteredServers.map(async (server) => {
        if (server.syncEnabled) {
          const radarr = new RadarrAPI({
            apiKey: server.apiKey,
            url: RadarrAPI.buildUrl(server, '/api/v3'),
          });

          try {
            this.refreshMonitoredDownloads(
              `radarr:${server.id}`,
              () => radarr.refreshMonitoredDownloads(),
              server.name
            );
            const queueItems = await radarr.getQueue();

            this.radarrServers[server.id] = queueItems.map((item) => ({
              externalId: item.movieId,
              estimatedCompletionTime: new Date(item.estimatedCompletionTime),
              mediaType: MediaType.MOVIE,
              size: item.size,
              sizeLeft: item.sizeleft,
              status: item.status,
              timeLeft: item.timeleft,
              title: item.title,
              downloadId: item.downloadId,
            }));

            if (queueItems.length > 0) {
              logger.debug(
                `Found ${queueItems.length} item(s) in progress on Radarr server: ${server.name}`,
                { label: 'Download Tracker' }
              );
            }
          } catch {
            logger.error(
              `Unable to get queue from Radarr server: ${server.name}`,
              {
                label: 'Download Tracker',
              }
            );
          }

          // Duplicate this data to matching servers
          const matchingServers = settings.radarr.filter(
            (rs) =>
              rs.hostname === server.hostname &&
              rs.port === server.port &&
              rs.baseUrl === server.baseUrl &&
              rs.id !== server.id
          );

          if (matchingServers.length > 0) {
            logger.debug(
              `Matching download data to ${matchingServers.length} other Radarr server(s)`,
              { label: 'Download Tracker' }
            );
          }

          matchingServers.forEach((ms) => {
            if (ms.syncEnabled) {
              this.radarrServers[ms.id] = this.radarrServers[server.id];
            }
          });
        }
      })
    );
  }

  private async updateSonarrDownloads() {
    const settings = getSettings();

    // Remove duplicate servers
    const filteredServers = uniqWith(settings.sonarr, (sonarrA, sonarrB) => {
      return (
        sonarrA.hostname === sonarrB.hostname &&
        sonarrA.port === sonarrB.port &&
        sonarrA.baseUrl === sonarrB.baseUrl
      );
    });

    // Load downloads from Sonarr servers
    await Promise.all(
      filteredServers.map(async (server) => {
        if (server.syncEnabled) {
          const sonarr = new SonarrAPI({
            apiKey: server.apiKey,
            url: SonarrAPI.buildUrl(server, '/api/v3'),
          });

          try {
            this.refreshMonitoredDownloads(
              `sonarr:${server.id}`,
              () => sonarr.refreshMonitoredDownloads(),
              server.name
            );
            const queueItems = await sonarr.getQueue();

            this.sonarrServers[server.id] = queueItems.map((item) => ({
              externalId: item.seriesId,
              estimatedCompletionTime: new Date(item.estimatedCompletionTime),
              mediaType: MediaType.TV,
              size: item.size,
              sizeLeft: item.sizeleft,
              status: item.status,
              timeLeft: item.timeleft,
              title: item.title,
              episode: item.episode,
              downloadId: item.downloadId,
            }));

            if (queueItems.length > 0) {
              logger.debug(
                `Found ${queueItems.length} item(s) in progress on Sonarr server: ${server.name}`,
                { label: 'Download Tracker' }
              );
            }
          } catch {
            logger.error(
              `Unable to get queue from Sonarr server: ${server.name}`,
              {
                label: 'Download Tracker',
              }
            );
          }

          // Duplicate this data to matching servers
          const matchingServers = settings.sonarr.filter(
            (ss) =>
              ss.hostname === server.hostname &&
              ss.port === server.port &&
              ss.baseUrl === server.baseUrl &&
              ss.id !== server.id
          );

          if (matchingServers.length > 0) {
            logger.debug(
              `Matching download data to ${matchingServers.length} other Sonarr server(s)`,
              { label: 'Download Tracker' }
            );
          }

          matchingServers.forEach((ms) => {
            if (ms.syncEnabled) {
              this.sonarrServers[ms.id] = this.sonarrServers[server.id];
            }
          });
        }
      })
    );
  }

  private async updateLidarrDownloads() {
    const settings = getSettings();

    const filteredServers = uniqWith(settings.lidarr, (lidarrA, lidarrB) => {
      return (
        lidarrA.hostname === lidarrB.hostname &&
        lidarrA.port === lidarrB.port &&
        lidarrA.baseUrl === lidarrB.baseUrl
      );
    });

    await Promise.all(
      filteredServers.map(async (server) => {
        if (server.syncEnabled) {
          const lidarr = new LidarrAPI({
            apiKey: server.apiKey,
            url: LidarrAPI.buildUrl(server, '/api/v1'),
          });

          try {
            this.refreshMonitoredDownloads(
              `lidarr:${server.id}`,
              () => lidarr.refreshMonitoredDownloads(),
              server.name
            );
            const queueItems = await lidarr.getQueue();

            this.lidarrServers[server.id] = queueItems
              .filter((item) => item.albumId !== undefined)
              .map((item) => ({
                externalId: item.albumId,
                estimatedCompletionTime: new Date(item.estimatedCompletionTime),
                mediaType: MediaType.MUSIC,
                size: item.size,
                sizeLeft: item.sizeleft,
                status: item.status,
                timeLeft: item.timeleft,
                title: item.title,
                downloadId: item.downloadId,
              }));

            if (queueItems.length > 0) {
              logger.debug(
                `Found ${queueItems.length} item(s) in progress on Lidarr server: ${server.name}`,
                { label: 'Download Tracker' }
              );
            }
          } catch (e) {
            logger.error(
              `Unable to get queue from Lidarr server: ${server.name}`,
              {
                errorMessage: e.message,
                label: 'Download Tracker',
              }
            );
          }

          const matchingServers = settings.lidarr.filter(
            (ls) =>
              ls.hostname === server.hostname &&
              ls.port === server.port &&
              ls.baseUrl === server.baseUrl &&
              ls.id !== server.id
          );

          if (matchingServers.length > 0) {
            logger.debug(
              `Matching download data to ${matchingServers.length} other Lidarr server(s)`,
              { label: 'Download Tracker' }
            );
          }

          matchingServers.forEach((ms) => {
            if (ms.syncEnabled) {
              this.lidarrServers[ms.id] = this.lidarrServers[server.id];
            }
          });
        }
      })
    );
  }

  private async updateReadarrDownloads() {
    const settings = getSettings();

    const filteredServers = uniqWith(settings.readarr, (readarrA, readarrB) => {
      return isMatchingReadarrDownloadServer(readarrA, readarrB);
    });

    await Promise.all(
      filteredServers.map(async (server) => {
        if (server.syncEnabled) {
          const readarr = new ReadarrAPI({
            apiKey: server.apiKey,
            url: ReadarrAPI.buildUrl(server, '/api/v1'),
          });

          try {
            this.refreshMonitoredDownloads(
              `readarr:${server.id}`,
              () => readarr.refreshMonitoredDownloads(),
              server.name
            );
            const queueItems = await readarr.getQueue();

            this.readarrServers[server.id] = queueItems
              .map((item) => ({
                item,
                bookId: item.bookId ?? item.book?.id,
              }))
              .filter(
                (
                  queueItem
                ): queueItem is typeof queueItem & { bookId: number } =>
                  queueItem.bookId !== undefined
              )
              .map(({ item, bookId }) => ({
                externalId: bookId,
                estimatedCompletionTime: new Date(item.estimatedCompletionTime),
                mediaType: MediaType.BOOK,
                size: item.size,
                sizeLeft: item.sizeleft,
                status: item.status,
                timeLeft: item.timeleft,
                title: item.title,
                downloadId: item.downloadId,
              }));

            if (queueItems.length > 0) {
              logger.debug(
                `Found ${queueItems.length} item(s) in progress on Bookshelf server: ${server.name}`,
                { label: 'Download Tracker' }
              );
            }
          } catch (e) {
            logger.error(
              `Unable to get queue from Bookshelf server: ${server.name}`,
              {
                errorMessage: e.message,
                label: 'Download Tracker',
              }
            );
          }

          const matchingServers = settings.readarr.filter(
            (rs) =>
              isMatchingReadarrDownloadServer(rs, server) && rs.id !== server.id
          );

          if (matchingServers.length > 0) {
            logger.debug(
              `Matching download data to ${matchingServers.length} other Bookshelf server(s)`,
              { label: 'Download Tracker' }
            );
          }

          matchingServers.forEach((ms) => {
            if (ms.syncEnabled) {
              this.readarrServers[ms.id] = this.readarrServers[server.id];
            }
          });
        }
      })
    );
  }
}

const downloadTracker = new DownloadTracker();

export default downloadTracker;
