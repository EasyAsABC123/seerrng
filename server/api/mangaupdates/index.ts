import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';

export interface MangaUpdatesSeriesHit {
  series_id: number;
  title: string;
  type?: string;
  year?: string;
}

export interface MangaUpdatesSeries extends MangaUpdatesSeriesHit {
  url?: string;
  status?: string;
  completed?: boolean;
  latest_chapter?: number;
  /**
   * Free text per anime season, for example
   * `Vol 1, Chap 1 (S1) / Vol 7, Chap 61 (S2)`. Often empty or partial.
   */
  anime?: { start?: string | null; end?: string | null } | null;
  related_series?: {
    relation_type: string;
    related_series_id: number;
    related_series_name: string;
  }[];
}

/** MangaUpdates public API. Used read-only for adaptation endpoints. */
class MangaUpdatesAPI extends ExternalAPI {
  constructor() {
    super(
      'https://api.mangaupdates.com/v1',
      {},
      {
        nodeCache: cacheManager.getCache('mangaupdates').data,
        rateLimit: { maxRequests: 5, maxRPS: 2 },
      }
    );
  }

  async searchSeries(
    search: string,
    perPage = 5
  ): Promise<MangaUpdatesSeriesHit[]> {
    const response = await this.post<{
      results?: { record?: MangaUpdatesSeriesHit }[];
    }>('/series/search', { search, perpage: perPage }, undefined, 24 * 60 * 60);
    return (response.results ?? [])
      .map((entry) => entry.record)
      .filter((record): record is MangaUpdatesSeriesHit => !!record);
  }

  async getSeries(seriesId: number): Promise<MangaUpdatesSeries> {
    return this.get<MangaUpdatesSeries>(
      `/series/${seriesId}`,
      undefined,
      6 * 60 * 60
    );
  }
}

export default MangaUpdatesAPI;
