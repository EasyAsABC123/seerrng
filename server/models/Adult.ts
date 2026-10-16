import type { MediaRequestStatus, MediaStatus } from '@server/constants/media';

export interface AdultResult {
  id: string;
  provider: 'whisparr';
  mediaType: 'adult';
  title: string;
  year?: number;
  overview?: string;
  studio?: string;
  posterPath?: undefined;
  backdropPath?: undefined;
  mediaInfo?: {
    id: number;
    status: MediaStatus;
    requestStatus?: MediaRequestStatus;
    requestId?: number;
  };
}

export type AdultDetails = AdultResult;
