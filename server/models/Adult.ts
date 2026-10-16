import type { MediaRequestStatus, MediaStatus } from '@server/constants/media';

export interface AdultResult {
  id: string;
  provider: 'whisparr';
  mediaType: 'adult';
  title: string;
  year?: number;
  overview?: string;
  studio?: string;
  performers: string[];
  posterPath?: string;
  backdropPath?: undefined;
  serviceId: number;
  serviceName: string;
  mediaInfo?: {
    id: number;
    status: MediaStatus;
    serviceId: number;
    requestStatus?: MediaRequestStatus;
    requestId?: number;
  };
}

export type AdultDetails = AdultResult;
