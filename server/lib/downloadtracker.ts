import LidarrAPI from '@server/api/servarr/lidarr';
import RadarrAPI from '@server/api/servarr/radarr';
import ReadarrAPI from '@server/api/servarr/readarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaType } from '@server/constants/media';
import {
  hasSameServarrServiceAuthority,
  runWithServarrServiceAdmission,
  type ServarrServiceType,
} from '@server/lib/serviceAdmission';
import {
  getSettings,
  type DVRSettings,
  type ReadarrSettings,
} from '@server/lib/settings';
import logger from '@server/logger';
import { trackBackgroundTask } from '@server/utils/backgroundTasks';
import { mapWithConcurrency } from '@server/utils/concurrency';
import { MAX_SERVARR_INSTANCES_PER_TYPE } from '@server/utils/servarrSettings';
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

export const DOWNLOAD_TRACKER_SERVER_CONCURRENCY = 5;

type DownloadTrackerServerSettings = DVRSettings &
  Partial<Pick<ReadarrSettings, 'serviceType'>>;

export const hasSameServarrDownloadAuthority = hasSameServarrServiceAuthority;

export class DownloadTracker {
  private static readonly monitoredRefreshCooldownMs = 5 * 60 * 1000;

  private radarrServers: Record<number, DownloadingItem[]> = {};
  private sonarrServers: Record<number, DownloadingItem[]> = {};
  private lidarrServers: Record<number, DownloadingItem[]> = {};
  private readarrServers: Record<number, DownloadingItem[]> = {};
  private monitoredRefreshes = new Set<string>();
  private lastMonitoredRefresh = new Map<string, number>();
  private activeUpdate?: Promise<void>;

  private runWithCurrentServarrDownloadServer<Result>(
    serviceType: ServarrServiceType,
    server: DownloadTrackerServerSettings,
    operation: () => Promise<Result>
  ): Promise<Result | undefined> {
    return runWithServarrServiceAdmission(
      [{ serviceType, serviceId: server.id }],
      async () => {
        const current = getSettings()[serviceType].find(
          (candidate) => candidate.id === server.id
        );
        if (
          !current ||
          !current.syncEnabled ||
          !hasSameServarrDownloadAuthority(current, server)
        ) {
          return undefined;
        }

        return operation();
      }
    );
  }

  private refreshMonitoredDownloads(
    key: string,
    serviceType: ServarrServiceType,
    server: DownloadTrackerServerSettings,
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
    trackBackgroundTask(
      `refresh monitored downloads for ${serverName}`,
      async () => {
        try {
          await this.runWithCurrentServarrDownloadServer(
            serviceType,
            server,
            refresh
          );
        } catch (e) {
          logger.debug(
            `Unable to refresh monitored downloads for server: ${serverName}`,
            {
              errorMessage: e instanceof Error ? e.message : String(e),
              label: 'Download Tracker',
            }
          );
        } finally {
          this.monitoredRefreshes.delete(key);
        }
      }
    );
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
    // A reset that races an update can otherwise be undone when the older
    // queue fetch writes its results after the reset. Drain that local update
    // first, then clear the snapshot and its refresh cooldowns.
    await this.activeUpdate?.catch(() => undefined);
    this.radarrServers = {};
    this.sonarrServers = {};
    this.lidarrServers = {};
    this.readarrServers = {};
    this.lastMonitoredRefresh.clear();
  }

  public updateDownloads(): Promise<void> {
    if (this.activeUpdate) {
      return this.activeUpdate;
    }

    const update = Promise.all([
      this.updateRadarrDownloads(),
      this.updateSonarrDownloads(),
      this.updateLidarrDownloads(),
      this.updateReadarrDownloads(),
    ])
      .then(() => undefined)
      .finally(() => {
        if (this.activeUpdate === update) {
          this.activeUpdate = undefined;
        }
      });
    this.activeUpdate = update;
    return update;
  }

  private async updateRadarrDownloads() {
    const settings = getSettings();

    // Remove duplicate servers
    const filteredServers = uniqWith(
      settings.radarr.slice(0, MAX_SERVARR_INSTANCES_PER_TYPE),
      (radarrA, radarrB) => {
        return (
          radarrA.hostname === radarrB.hostname &&
          radarrA.port === radarrB.port &&
          radarrA.baseUrl === radarrB.baseUrl
        );
      }
    );

    // Load downloads from Radarr servers
    await mapWithConcurrency(
      filteredServers,
      DOWNLOAD_TRACKER_SERVER_CONCURRENCY,
      async (server) => {
        if (server.syncEnabled) {
          const radarr = new RadarrAPI({
            apiKey: server.apiKey,
            url: RadarrAPI.buildUrl(server, '/api/v3'),
          });

          try {
            this.refreshMonitoredDownloads(
              `radarr:${server.id}`,
              'radarr',
              server,
              () => radarr.refreshMonitoredDownloads(),
              server.name
            );
            const queueItems = await this.runWithCurrentServarrDownloadServer(
              'radarr',
              server,
              () => radarr.getQueue()
            );
            if (!queueItems) {
              delete this.radarrServers[server.id];
              return;
            }

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
      }
    );
  }

  private async updateSonarrDownloads() {
    const settings = getSettings();

    // Remove duplicate servers
    const filteredServers = uniqWith(
      settings.sonarr.slice(0, MAX_SERVARR_INSTANCES_PER_TYPE),
      (sonarrA, sonarrB) => {
        return (
          sonarrA.hostname === sonarrB.hostname &&
          sonarrA.port === sonarrB.port &&
          sonarrA.baseUrl === sonarrB.baseUrl
        );
      }
    );

    // Load downloads from Sonarr servers
    await mapWithConcurrency(
      filteredServers,
      DOWNLOAD_TRACKER_SERVER_CONCURRENCY,
      async (server) => {
        if (server.syncEnabled) {
          const sonarr = new SonarrAPI({
            apiKey: server.apiKey,
            url: SonarrAPI.buildUrl(server, '/api/v3'),
          });

          try {
            this.refreshMonitoredDownloads(
              `sonarr:${server.id}`,
              'sonarr',
              server,
              () => sonarr.refreshMonitoredDownloads(),
              server.name
            );
            const queueItems = await this.runWithCurrentServarrDownloadServer(
              'sonarr',
              server,
              () => sonarr.getQueue()
            );
            if (!queueItems) {
              delete this.sonarrServers[server.id];
              return;
            }

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
      }
    );
  }

  private async updateLidarrDownloads() {
    const settings = getSettings();

    const filteredServers = uniqWith(
      settings.lidarr.slice(0, MAX_SERVARR_INSTANCES_PER_TYPE),
      (lidarrA, lidarrB) => {
        return (
          lidarrA.hostname === lidarrB.hostname &&
          lidarrA.port === lidarrB.port &&
          lidarrA.baseUrl === lidarrB.baseUrl
        );
      }
    );

    await mapWithConcurrency(
      filteredServers,
      DOWNLOAD_TRACKER_SERVER_CONCURRENCY,
      async (server) => {
        if (server.syncEnabled) {
          const lidarr = new LidarrAPI({
            apiKey: server.apiKey,
            url: LidarrAPI.buildUrl(server, '/api/v1'),
          });

          try {
            this.refreshMonitoredDownloads(
              `lidarr:${server.id}`,
              'lidarr',
              server,
              () => lidarr.refreshMonitoredDownloads(),
              server.name
            );
            const queueItems = await this.runWithCurrentServarrDownloadServer(
              'lidarr',
              server,
              () => lidarr.getQueue()
            );
            if (!queueItems) {
              delete this.lidarrServers[server.id];
              return;
            }

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
      }
    );
  }

  private async updateReadarrDownloads() {
    const settings = getSettings();

    const filteredServers = uniqWith(
      settings.readarr.slice(0, MAX_SERVARR_INSTANCES_PER_TYPE),
      (readarrA, readarrB) =>
        isMatchingReadarrDownloadServer(readarrA, readarrB)
    );

    await mapWithConcurrency(
      filteredServers,
      DOWNLOAD_TRACKER_SERVER_CONCURRENCY,
      async (server) => {
        if (server.syncEnabled) {
          const readarr = new ReadarrAPI({
            apiKey: server.apiKey,
            url: ReadarrAPI.buildUrl(server, '/api/v1'),
          });

          try {
            this.refreshMonitoredDownloads(
              `readarr:${server.id}`,
              'readarr',
              server,
              () => readarr.refreshMonitoredDownloads(),
              server.name
            );
            const queueItems = await this.runWithCurrentServarrDownloadServer(
              'readarr',
              server,
              () => readarr.getQueue()
            );
            if (!queueItems) {
              delete this.readarrServers[server.id];
              return;
            }

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
      }
    );
  }
}

const downloadTracker = new DownloadTracker();

export default downloadTracker;
