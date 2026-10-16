import type TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import {
  MOVIE_MATURITY_LIMITS,
  TV_MATURITY_LIMITS,
} from '@server/constants/videoMaturity';
import { getRepository } from '@server/datasource';
import { UserSettings } from '@server/entity/UserSettings';
import type {
  MovieMaturityLimit,
  TvMaturityLimit,
} from '@server/interfaces/api/userSettingsInterfaces';
import { mapWithConcurrency } from '@server/utils/concurrency';

export type VideoMaturityMediaType = MediaType.MOVIE | MediaType.TV;

export type UserVideoMaturityPolicy = {
  movie: MovieMaturityLimit | null;
  tv: TvMaturityLimit | null;
};

export type VideoMaturityListItem = {
  id: number;
  mediaType: VideoMaturityMediaType;
};

const movieRatingOrder: Record<string, number> = {
  G: 0,
  PG: 1,
  'PG-13': 2,
  R: 3,
  'NC-17': 4,
  X: 5,
};

const tvRatingOrder: Record<string, number> = {
  'TV-Y': 0,
  'TV-Y7': 1,
  'TV-G': 2,
  'TV-PG': 3,
  'TV-14': 4,
  'TV-MA': 5,
};

const getOrder = (
  value: string,
  mediaType: VideoMaturityMediaType
): number | undefined =>
  (mediaType === MediaType.MOVIE ? movieRatingOrder : tvRatingOrder)[
    value.trim().toUpperCase()
  ];

const getLimitOrder = (
  limit: string,
  mediaType: VideoMaturityMediaType
): number | undefined => getOrder(limit, mediaType);

const areRatingsWithinLimit = (
  ratings: string[],
  limit: string,
  mediaType: VideoMaturityMediaType
): boolean => {
  const maximum = getLimitOrder(limit, mediaType);
  if (maximum === undefined || ratings.length === 0) {
    return false;
  }

  return ratings.every((rating) => {
    const order = getOrder(rating, mediaType);
    return order !== undefined && order <= maximum;
  });
};

/** A configured cap requires a recognized US rating and rejects unknown labels. */
export const isVideoWithinMaturityLimit = (
  details: TmdbMovieDetails | TmdbTvDetails,
  mediaType: VideoMaturityMediaType,
  limit: string | null | undefined
): boolean => {
  if (limit === null || limit === undefined) {
    return true;
  }

  if (mediaType === MediaType.MOVIE) {
    const movie = details as TmdbMovieDetails;
    const ratings = (movie.release_dates?.results ?? [])
      .filter((release) => release.iso_3166_1?.toUpperCase() === 'US')
      .flatMap((release) => release.release_dates ?? [])
      .map((release) =>
        typeof release.certification === 'string'
          ? release.certification.trim()
          : ''
      )
      .filter(Boolean);

    return areRatingsWithinLimit(ratings, limit, mediaType);
  }

  const tv = details as TmdbTvDetails;
  const ratings = (tv.content_ratings?.results ?? [])
    .filter((rating) => rating.iso_3166_1?.toUpperCase() === 'US')
    .map((rating) =>
      typeof rating.rating === 'string' ? rating.rating.trim() : ''
    )
    .filter(Boolean);

  return areRatingsWithinLimit(ratings, limit, mediaType);
};

export const getUserVideoMaturityPolicy = async (
  userId: number
): Promise<UserVideoMaturityPolicy> => {
  const settings = await getRepository(UserSettings).findOne({
    where: { user: { id: userId } },
  });

  return {
    movie: settings?.movieMaturityRatingLimit ?? null,
    tv: settings?.tvMaturityRatingLimit ?? null,
  };
};

export const filterVideoResultsByMaturityPolicy = async <
  T extends { id: number },
>(
  tmdb: TheMovieDb,
  policy: UserVideoMaturityPolicy,
  mediaType: VideoMaturityMediaType,
  results: T[],
  language?: string
): Promise<T[]> => {
  const limit = policy[mediaType === MediaType.MOVIE ? 'movie' : 'tv'];
  if (limit === null || results.length === 0) {
    return results;
  }

  const allowed = await mapWithConcurrency(results, 4, async (result) => {
    try {
      const details =
        mediaType === MediaType.MOVIE
          ? await tmdb.getMovie({ movieId: result.id, language })
          : await tmdb.getTvShow({ tvId: result.id, language });

      return isVideoWithinMaturityLimit(details, mediaType, limit);
    } catch {
      // A cap is protective: unavailable rating metadata cannot admit a title.
      return false;
    }
  });

  return results.filter((_, index) => allowed[index]);
};

export const filterVideoItemsByMaturityPolicy = async <
  T extends VideoMaturityListItem,
>(
  tmdb: TheMovieDb,
  policy: UserVideoMaturityPolicy,
  results: T[],
  language?: string
): Promise<T[]> => {
  const [movies, tv] = await Promise.all([
    filterVideoResultsByMaturityPolicy(
      tmdb,
      policy,
      MediaType.MOVIE,
      results
        .filter((result) => result.mediaType === MediaType.MOVIE)
        .map((result) => result),
      language
    ),
    filterVideoResultsByMaturityPolicy(
      tmdb,
      policy,
      MediaType.TV,
      results.filter((result) => result.mediaType === MediaType.TV),
      language
    ),
  ]);
  const allowedKeys = new Set([
    ...movies.map((result) => `${MediaType.MOVIE}:${result.id}`),
    ...tv.map((result) => `${MediaType.TV}:${result.id}`),
  ]);

  return results.filter((result) =>
    allowedKeys.has(`${result.mediaType}:${result.id}`)
  );
};

export const filterVideoItemsForUser = async <T extends VideoMaturityListItem>(
  tmdb: TheMovieDb,
  userId: number | undefined,
  results: T[],
  language?: string
): Promise<T[]> => {
  if (!userId || results.length === 0) {
    return results;
  }

  return filterVideoItemsByMaturityPolicy(
    tmdb,
    await getUserVideoMaturityPolicy(userId),
    results,
    language
  );
};

export const doesUserAllowVideo = async (
  tmdb: TheMovieDb,
  userId: number,
  mediaType: VideoMaturityMediaType,
  tmdbId: number,
  language?: string
): Promise<boolean> => {
  const policy = await getUserVideoMaturityPolicy(userId);
  const limit = policy[mediaType === MediaType.MOVIE ? 'movie' : 'tv'];
  if (limit === null) {
    return true;
  }

  const details =
    mediaType === MediaType.MOVIE
      ? await tmdb.getMovie({ movieId: tmdbId, language })
      : await tmdb.getTvShow({ tvId: tmdbId, language });

  return isVideoWithinMaturityLimit(details, mediaType, limit);
};

export const isMovieMaturityLimit = (
  value: unknown
): value is MovieMaturityLimit =>
  typeof value === 'string' &&
  (MOVIE_MATURITY_LIMITS as readonly string[]).includes(value);

export const isTvMaturityLimit = (value: unknown): value is TvMaturityLimit =>
  typeof value === 'string' &&
  (TV_MATURITY_LIMITS as readonly string[]).includes(value);
