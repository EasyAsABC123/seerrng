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
  description?: string;
  managementUrl?: string;
  truncated: boolean;
  scope: 'backend-library';
  entries: (SeriesCatalogEntry & {
    matchStatus: 'matched' | 'unmatched' | 'ambiguous';
    book?: BookResult;
  })[];
}
