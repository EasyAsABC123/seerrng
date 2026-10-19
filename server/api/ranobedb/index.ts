import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';

export interface RanobeDbSeriesHit {
  id: number;
  title: string;
  title_orig?: string | null;
  romaji?: string | null;
  olang?: string;
  lang?: string;
  c_num_books?: number;
}

export interface RanobeDbBook {
  id: number;
  title: string;
  title_orig?: string | null;
  lang?: string;
  /** Release date per language as YYYYMMDD, e.g. { en: 20220623, ja: 20161220 }. */
  c_release_dates?: Record<string, number>;
  sort_order?: number;
  book_type?: string;
  image?: { filename?: string } | null;
}

export interface RanobeDbSeries extends RanobeDbSeriesHit {
  anilist_id?: number | null;
  mal_id?: number | null;
  publication_status?: string;
  books: RanobeDbBook[];
}

/** RanobeDB read API: ordered light-novel volumes with per-language releases. */
class RanobeDbAPI extends ExternalAPI {
  constructor() {
    super(
      'https://ranobedb.org/api/v0',
      {},
      {
        nodeCache: cacheManager.getCache('ranobedb').data,
        rateLimit: { maxRequests: 5, maxRPS: 2 },
      }
    );
  }

  async searchSeries(q: string, limit = 5): Promise<RanobeDbSeriesHit[]> {
    const response = await this.get<{ series?: RanobeDbSeriesHit[] }>(
      '/series',
      { params: { q, limit } },
      24 * 60 * 60
    );
    return response.series ?? [];
  }

  async getSeries(id: number): Promise<RanobeDbSeries> {
    const response = await this.get<
      { series?: RanobeDbSeries } & RanobeDbSeries
    >(`/series/${id}`, undefined, 6 * 60 * 60);
    return (response.series ?? response) as RanobeDbSeries;
  }
}

export default RanobeDbAPI;
