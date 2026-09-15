import type { BookResult } from '@server/models/Book';

export interface BookSeriesSummary {
  id: number;
  title: string;
  serverName: string;
  format: 'ebook' | 'audiobook';
  position?: string;
}

export interface SeriesCatalogEntry {
  providerId: string;
  title: string;
  position?: string;
  primary?: boolean;
  isbns: string[];
}

export interface BookSeriesDetails extends BookSeriesSummary {
  watchTarget?: BookSeriesWatchTarget;
  description?: string;
  managementUrl?: string;
  truncated: boolean;
  scope: 'backend-library';
  entries: (SeriesCatalogEntry & {
    matchStatus: 'matched' | 'unmatched' | 'ambiguous';
    book?: BookResult;
  })[];
}

export interface BookSeriesSearchVariant {
  key: string;
  title: string;
  serverName: string;
  format: 'ebook' | 'audiobook';
  source: 'library' | 'catalog';
  providerId?: string;
  href: string;
  bookCount?: number;
  description?: string;
}

export interface BookSeriesSearchResult extends BookSeriesSearchVariant {
  variants?: BookSeriesSearchVariant[];
}

export interface BookSeriesSearchResponse {
  results: BookSeriesSearchResult[];
  status: 'ok' | 'partial' | 'unavailable' | 'unsupported' | 'disabled';
  truncated: boolean;
}

export interface BookSeriesPreview {
  title: string;
  description?: string;
  serverName: string;
  format: 'ebook' | 'audiobook';
  bookCount: number;
  managementUrl?: string;
  resolutionTruncated: boolean;
  books: {
    title: string;
    position?: string;
    author?: string;
    matchStatus: 'matched' | 'unmatched' | 'ambiguous' | 'unavailable';
    book?: BookResult;
  }[];
}

export interface BookSeriesWatchTarget {
  serverId: number;
  scope: string;
  providerId: string;
}
export interface BookSeriesWatchStatus {
  supported: boolean;
  enabled?: boolean;
  request?: {
    id: number;
    title: string;
    format: 'ebook' | 'audiobook';
    status: string;
    includeExtras: boolean;
  };
}
