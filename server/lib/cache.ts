import NodeCache from 'node-cache';
import { serialize } from 'node:v8';

export type AvailableCacheIds =
  | 'tmdb'
  | 'radarr'
  | 'sonarr'
  | 'rt'
  | 'imdb'
  | 'github'
  | 'plexguid'
  | 'plextv'
  | 'plexwatchlist'
  | 'tvdb'
  | 'lidarr'
  | 'readarr'
  | 'musicbrainz'
  | 'listenbrainz'
  | 'coverartarchive'
  | 'openlibrary'
  | 'wikidata'
  | 'tadb'
  | 'associations';

const DEFAULT_TTL = 300;
const DEFAULT_CHECK_PERIOD = 120;
export const DEFAULT_MAX_CACHE_KEYS = 10_000;
export const DEFAULT_MAX_CACHE_BYTES = 64 * 1024 * 1024;

export const estimateCacheEntryBytes = (key: string, value: unknown): number =>
  Buffer.byteLength(key, 'utf8') + serialize(value).byteLength;

export class Cache {
  public id: AvailableCacheIds;
  public data: NodeCache;
  public name: string;
  private readonly keyOrder = new Map<string, undefined>();
  private readonly keyBytes = new Map<string, number>();
  private readonly maxKeys: number;
  private readonly maxBytes: number;
  private totalBytes = 0;

  constructor(
    id: AvailableCacheIds,
    name: string,
    options: {
      stdTtl?: number;
      checkPeriod?: number;
      maxKeys?: number;
      maxBytes?: number;
    } = {}
  ) {
    this.id = id;
    this.name = name;
    this.maxKeys = options.maxKeys ?? DEFAULT_MAX_CACHE_KEYS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_CACHE_BYTES;
    if (!Number.isSafeInteger(this.maxKeys) || this.maxKeys <= 0) {
      throw new Error('Cache key limit must be a positive integer.');
    }
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes <= 0) {
      throw new Error('Cache byte limit must be a positive integer.');
    }
    this.data = new NodeCache({
      stdTTL: options.stdTtl ?? DEFAULT_TTL,
      checkperiod: options.checkPeriod ?? DEFAULT_CHECK_PERIOD,
    });
    this.data.on('set', (key: string, value: unknown) => {
      this.totalBytes -= this.keyBytes.get(key) ?? 0;
      let entryBytes: number;
      try {
        entryBytes = estimateCacheEntryBytes(key, value);
      } catch {
        entryBytes = this.maxBytes + 1;
      }
      this.keyBytes.set(key, entryBytes);
      this.totalBytes += entryBytes;
      this.keyOrder.delete(key);
      this.keyOrder.set(key, undefined);

      while (
        this.keyOrder.size > this.maxKeys ||
        this.totalBytes > this.maxBytes
      ) {
        const oldestKey = this.keyOrder.keys().next().value;
        if (oldestKey === undefined) {
          break;
        }
        this.data.del(oldestKey);
      }
    });
    const forgetKey = (key: string) => {
      this.keyOrder.delete(key);
      this.totalBytes -= this.keyBytes.get(key) ?? 0;
      this.keyBytes.delete(key);
    };
    this.data.on('del', forgetKey);
    this.data.on('expired', forgetKey);
    this.data.on('flush', () => {
      this.keyOrder.clear();
      this.keyBytes.clear();
      this.totalBytes = 0;
    });
  }

  public getStats() {
    return this.data.getStats();
  }

  public flush(): void {
    this.data.flushAll();
  }
}

class CacheManager {
  private availableCaches: Record<AvailableCacheIds, Cache> = {
    tmdb: new Cache('tmdb', 'The Movie Database API', {
      stdTtl: 21600,
      checkPeriod: 60 * 30,
    }),
    radarr: new Cache('radarr', 'Radarr API'),
    sonarr: new Cache('sonarr', 'Sonarr API'),
    rt: new Cache('rt', 'Rotten Tomatoes API', {
      stdTtl: 43200,
      checkPeriod: 60 * 30,
    }),
    imdb: new Cache('imdb', 'IMDB Radarr Proxy', {
      stdTtl: 43200,
      checkPeriod: 60 * 30,
    }),
    github: new Cache('github', 'GitHub API', {
      stdTtl: 21600,
      checkPeriod: 60 * 30,
    }),
    plexguid: new Cache('plexguid', 'Plex GUID', {
      stdTtl: 86400 * 7, // 1 week cache
      checkPeriod: 60 * 30,
    }),
    plextv: new Cache('plextv', 'Plex TV', {
      stdTtl: 86400 * 7, // 1 week cache
      checkPeriod: 60,
    }),
    plexwatchlist: new Cache('plexwatchlist', 'Plex Watchlist'),
    tvdb: new Cache('tvdb', 'The TVDB API', {
      stdTtl: 21600,
      checkPeriod: 60 * 30,
    }),
    lidarr: new Cache('lidarr', 'Lidarr API'),
    readarr: new Cache('readarr', 'Bookshelf API'),
    musicbrainz: new Cache('musicbrainz', 'MusicBrainz API', {
      stdTtl: 21600,
      checkPeriod: 60 * 30,
    }),
    listenbrainz: new Cache('listenbrainz', 'ListenBrainz API', {
      stdTtl: 21600,
      checkPeriod: 60 * 30,
    }),
    coverartarchive: new Cache('coverartarchive', 'Cover Art Archive API', {
      stdTtl: 43200,
      checkPeriod: 60 * 30,
    }),
    openlibrary: new Cache('openlibrary', 'Open Library API', {
      stdTtl: 43200,
      checkPeriod: 60 * 30,
    }),
    wikidata: new Cache('wikidata', 'Wikidata API', {
      stdTtl: 43200,
      checkPeriod: 60 * 30,
    }),
    tadb: new Cache('tadb', 'TheAudioDB API', {
      stdTtl: 43200,
      checkPeriod: 60 * 30,
    }),
    associations: new Cache('associations', 'Cross-Medium Associations', {
      stdTtl: 43200,
      checkPeriod: 60 * 30,
    }),
  };

  public getCache(id: AvailableCacheIds): Cache {
    return this.availableCaches[id];
  }

  public getAllCaches(): Record<string, Cache> {
    return this.availableCaches;
  }
}

const cacheManager = new CacheManager();

export const isAvailableCacheId = (id: string): id is AvailableCacheIds =>
  Object.prototype.hasOwnProperty.call(cacheManager.getAllCaches(), id);

export default cacheManager;
