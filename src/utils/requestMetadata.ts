import {
  encodeApiPathSegment,
  normalizeMusicBrainzId,
  normalizeOpenLibraryWorkId,
} from './apiPath';

type RequestMetadataSource = {
  type: string;
  media: {
    tmdbId?: number | null;
    mbId?: string | null;
    identifiers?: { provider: string; value: string }[];
  };
};

export const getRequestMetadataApiPath = (
  request: RequestMetadataSource
): string | null => {
  if (request.type === 'movie') {
    return `/api/v1/movie/${request.media.tmdbId}`;
  }

  if (request.type === 'tv') {
    return `/api/v1/tv/${request.media.tmdbId}`;
  }

  if (request.type === 'music' && request.media.mbId) {
    const musicId = normalizeMusicBrainzId(request.media.mbId);
    return `/api/v1/music/${encodeApiPathSegment(musicId)}`;
  }

  if (request.type === 'book') {
    const bookId = request.media.identifiers?.find(
      (identifier) => identifier.provider === 'openlibrary'
    )?.value;

    if (bookId) {
      return `/api/v1/book/${encodeApiPathSegment(
        normalizeOpenLibraryWorkId(bookId)
      )}`;
    }
  }

  return null;
};
