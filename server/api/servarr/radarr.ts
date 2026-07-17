import logger from '@server/logger';
import { redactSecrets } from '@server/utils/security';
import ServarrBase, {
  MAX_SERVARR_LIBRARY_RESULTS,
  MAX_SERVARR_LOOKUP_RESULTS,
  sanitizeServarrRecordArray,
} from './base';

const MAX_RADARR_TEXT_LENGTH = 10_000;
const MAX_RADARR_TAGS = 1_000;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, MAX_RADARR_TEXT_LENGTH) : '';
const number = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;
const integer = (value: unknown): number =>
  Number.isSafeInteger(value) ? (value as number) : 0;
const boolean = (value: unknown): boolean => value === true;
const optionalText = (value: unknown): string | undefined => {
  const normalized = text(value);
  return normalized || undefined;
};

export const sanitizeRadarrMovie = (
  value: unknown
): RadarrMovie | undefined => {
  if (!isRecord(value)) return undefined;
  const tmdbId = integer(value.tmdbId);
  const id = integer(value.id);
  const title = text(value.title);
  if (tmdbId <= 0 || !title) return undefined;

  const movieFile = isRecord(value.movieFile)
    ? {
        id: integer(value.movieFile.id),
        movieId: integer(value.movieFile.movieId),
        relativePath: optionalText(value.movieFile.relativePath),
        path: optionalText(value.movieFile.path),
        size: number(value.movieFile.size),
        dateAdded: text(value.movieFile.dateAdded),
        sceneName: optionalText(value.movieFile.sceneName),
        releaseGroup: optionalText(value.movieFile.releaseGroup),
        edition: optionalText(value.movieFile.edition),
        indexerFlags: Number.isSafeInteger(value.movieFile.indexerFlags)
          ? (value.movieFile.indexerFlags as number)
          : undefined,
        mediaInfo: (() => {
          const info = isRecord(value.movieFile.mediaInfo)
            ? value.movieFile.mediaInfo
            : {};
          return {
            id: integer(info.id),
            audioBitrate: number(info.audioBitrate),
            audioChannels: number(info.audioChannels),
            audioCodec: optionalText(info.audioCodec),
            audioLanguages: optionalText(info.audioLanguages),
            audioStreamCount: number(info.audioStreamCount),
            videoBitDepth: number(info.videoBitDepth),
            videoBitrate: number(info.videoBitrate),
            videoCodec: optionalText(info.videoCodec),
            videoFps: number(info.videoFps),
            videoDynamicRange: optionalText(info.videoDynamicRange),
            videoDynamicRangeType: optionalText(info.videoDynamicRangeType),
            resolution: optionalText(info.resolution),
            runTime: optionalText(info.runTime),
            scanType: optionalText(info.scanType),
            subtitles: optionalText(info.subtitles),
          };
        })(),
        originalFilePath: optionalText(value.movieFile.originalFilePath),
        qualityCutoffNotMet: boolean(value.movieFile.qualityCutoffNotMet),
      }
    : undefined;

  return {
    id: id > 0 ? id : 0,
    title,
    isAvailable: boolean(value.isAvailable),
    monitored: boolean(value.monitored),
    tmdbId,
    imdbId: text(value.imdbId),
    titleSlug: text(value.titleSlug),
    folderName: text(value.folderName),
    path: text(value.path),
    profileId: integer(value.profileId),
    qualityProfileId: integer(value.qualityProfileId),
    added: text(value.added),
    hasFile: boolean(value.hasFile),
    tags: (Array.isArray(value.tags) ? value.tags : [])
      .slice(0, MAX_RADARR_TAGS)
      .filter((tag): tag is number => Number.isSafeInteger(tag) && tag >= 0),
    movieFile,
  };
};

const requireRadarrMovie = (value: unknown): RadarrMovie => {
  const movie = sanitizeRadarrMovie(value);
  if (!movie) throw new Error('Radarr returned an invalid movie');
  return movie;
};

const isConflictError = (error: unknown): boolean =>
  (typeof error === 'object' &&
    error !== null &&
    (error as { response?: { status?: number } }).response?.status === 409) ||
  (error instanceof Error && /status code 409/i.test(error.message));

export interface RadarrMovieOptions {
  title: string;
  qualityProfileId: number;
  minimumAvailability: string;
  tags: number[];
  profileId: number;
  year: number;
  rootFolderPath: string;
  tmdbId: number;
  monitored?: boolean;
  searchNow?: boolean;
}

export interface RadarrMovie {
  id: number;
  title: string;
  isAvailable: boolean;
  monitored: boolean;
  tmdbId: number;
  imdbId: string;
  titleSlug: string;
  folderName: string;
  path: string;
  profileId: number;
  qualityProfileId: number;
  added: string;
  hasFile: boolean;
  tags: number[];
  movieFile?: {
    id: number;
    movieId: number;
    relativePath?: string;
    path?: string;
    size: number;
    dateAdded: string;
    sceneName?: string;
    releaseGroup?: string;
    edition?: string;
    indexerFlags?: number;
    mediaInfo: {
      id: number;
      audioBitrate: number;
      audioChannels: number;
      audioCodec?: string;
      audioLanguages?: string;
      audioStreamCount: number;
      videoBitDepth: number;
      videoBitrate: number;
      videoCodec?: string;
      videoFps: number;
      videoDynamicRange?: string;
      videoDynamicRangeType?: string;
      resolution?: string;
      runTime?: string;
      scanType?: string;
      subtitles?: string;
    };
    originalFilePath?: string;
    qualityCutoffNotMet: boolean;
  };
}

class RadarrAPI extends ServarrBase<{ movieId: number }> {
  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url, apiKey, cacheName: 'radarr', apiName: 'Radarr' });
  }

  public getMovies = async (): Promise<RadarrMovie[]> => {
    try {
      const response = await this.axios.get<RadarrMovie[]>('/movie');

      return sanitizeServarrRecordArray<Record<string, unknown>>(
        response.data,
        MAX_SERVARR_LIBRARY_RESULTS
      ).flatMap((movie) => {
        const normalized = sanitizeRadarrMovie(movie);
        return normalized ? [normalized] : [];
      });
    } catch (e) {
      throw new Error(`[Radarr] Failed to retrieve movies: ${e.message}`, {
        cause: e,
      });
    }
  };

  public getMovie = async ({ id }: { id: number }): Promise<RadarrMovie> => {
    try {
      const response = await this.axios.get<RadarrMovie>(`/movie/${id}`);

      return requireRadarrMovie(response.data);
    } catch (e) {
      throw new Error(`[Radarr] Failed to retrieve movie: ${e.message}`, {
        cause: e,
      });
    }
  };

  public async getMovieByTmdbId(id: number): Promise<RadarrMovie> {
    try {
      const response = await this.axios.get<RadarrMovie[]>('/movie/lookup', {
        params: {
          term: `tmdb:${id}`,
        },
      });

      const movies = sanitizeServarrRecordArray<Record<string, unknown>>(
        response.data,
        MAX_SERVARR_LOOKUP_RESULTS
      ).flatMap((movie) => {
        const normalized = sanitizeRadarrMovie(movie);
        return normalized ? [normalized] : [];
      });
      if (!movies[0]) {
        throw new Error('Movie not found');
      }

      return movies[0];
    } catch (e) {
      logger.error('Error retrieving movie by TMDB ID', {
        label: 'Radarr API',
        errorMessage: e.message,
        tmdbId: id,
      });
      throw new Error('Movie not found', { cause: e });
    }
  }

  public addMovie = async (
    options: RadarrMovieOptions
  ): Promise<RadarrMovie> => {
    try {
      const movie = await this.getMovieByTmdbId(options.tmdbId);

      if (movie.hasFile) {
        logger.info(
          'Title already exists and is available. Skipping add and returning success',
          {
            label: 'Radarr',
            movie,
          }
        );
        return movie;
      }

      // movie exists in Radarr but is neither downloaded nor monitored
      if (movie.id && !movie.monitored) {
        const response = await this.axios.put<RadarrMovie>(`/movie`, {
          ...movie,
          title: options.title,
          qualityProfileId: options.qualityProfileId,
          profileId: options.profileId,
          titleSlug: options.tmdbId.toString(),
          minimumAvailability: options.minimumAvailability,
          tmdbId: options.tmdbId,
          year: options.year,
          tags: Array.from(new Set([...movie.tags, ...options.tags])),
          rootFolderPath: options.rootFolderPath,
          monitored: options.monitored,
          addOptions: {
            searchForMovie: options.searchNow,
          },
        });

        const updatedMovie = requireRadarrMovie(
          isRecord(response.data)
            ? { ...movie, ...response.data }
            : response.data
        );
        if (updatedMovie.monitored) {
          logger.info(
            'Found existing title in Radarr and set it to monitored.',
            {
              label: 'Radarr',
              movieId: updatedMovie.id,
              movieTitle: updatedMovie.title,
            }
          );
          logger.debug('Radarr update details', {
            label: 'Radarr',
            movie: updatedMovie,
          });

          if (options.searchNow) {
            await this.searchMovie(updatedMovie.id);
          }

          return updatedMovie;
        } else {
          logger.error('Failed to update existing movie in Radarr.', {
            label: 'Radarr',
            options,
          });
          throw new Error('Failed to update existing movie in Radarr');
        }
      }

      if (movie.id) {
        // Movie exists and is already monitored
        logger.info('Movie is already monitored in Radarr.', {
          label: 'Radarr',
          movieId: movie.id,
          movieTitle: movie.title,
          hasFile: movie.hasFile,
        });

        // If searchNow is requested and movie doesn't have a file, trigger search
        if (options.searchNow && !movie.hasFile) {
          logger.info(
            'Triggering search for existing monitored movie without file',
            {
              label: 'Radarr',
              movieId: movie.id,
              movieTitle: movie.title,
            }
          );
          await this.searchMovie(movie.id);
        }

        return movie;
      }

      const response = await this.axios.post<RadarrMovie>(`/movie`, {
        title: options.title,
        qualityProfileId: options.qualityProfileId,
        profileId: options.profileId,
        titleSlug: options.tmdbId.toString(),
        minimumAvailability: options.minimumAvailability,
        tmdbId: options.tmdbId,
        year: options.year,
        rootFolderPath: options.rootFolderPath,
        monitored: options.monitored,
        tags: options.tags,
        addOptions: {
          searchForMovie: options.searchNow,
        },
      });

      const addedMovie = requireRadarrMovie(
        isRecord(response.data)
          ? {
              tmdbId: options.tmdbId,
              title: options.title,
              ...(response.data as unknown as Record<string, unknown>),
            }
          : response.data
      );
      if (addedMovie.id) {
        logger.info('Radarr accepted request', { label: 'Radarr' });
        logger.debug('Radarr add details', {
          label: 'Radarr',
          movie: addedMovie,
        });
      } else {
        logger.error('Failed to add movie to Radarr', {
          label: 'Radarr',
          options,
        });
        throw new Error('Failed to add movie to Radarr');
      }
      return addedMovie;
    } catch (e) {
      if (isConflictError(e)) {
        const existingMovie = await this.recoverExistingMovie(options).catch(
          (recoveryError) => {
            logger.warn(
              'Failed to recover existing Radarr movie after conflict.',
              {
                label: 'Radarr',
                errorMessage:
                  recoveryError instanceof Error
                    ? recoveryError.message
                    : 'Unknown recovery error',
                options,
              }
            );

            return undefined;
          }
        );

        if (existingMovie) {
          return existingMovie;
        }
      }

      logger.error(
        'Failed to add movie to Radarr. This might happen if the movie already exists, in which case you can safely ignore this error.',
        {
          label: 'Radarr',
          errorMessage: e.message,
          options,
          response: redactSecrets(e?.response?.data),
        }
      );
      throw new Error('Failed to add movie to Radarr', { cause: e });
    }
  };

  private async recoverExistingMovie(
    options: RadarrMovieOptions
  ): Promise<RadarrMovie | undefined> {
    const movies = await this.getMovies();
    const movie = movies.find((item) => item.tmdbId === options.tmdbId);

    if (!movie) {
      return undefined;
    }

    logger.warn('Recovered existing Radarr movie after add conflict.', {
      label: 'Radarr',
      movieId: movie.id,
      movieTitle: movie.title,
      tmdbId: movie.tmdbId,
    });

    if (!movie.monitored) {
      const response = await this.axios.put<RadarrMovie>('/movie', {
        ...movie,
        title: options.title,
        qualityProfileId: options.qualityProfileId,
        profileId: options.profileId,
        minimumAvailability: options.minimumAvailability,
        tags: Array.from(new Set([...movie.tags, ...options.tags])),
        rootFolderPath: options.rootFolderPath,
        monitored: options.monitored,
        addOptions: {
          searchForMovie: options.searchNow,
        },
      });

      return requireRadarrMovie(
        isRecord(response.data) ? { ...movie, ...response.data } : response.data
      );
    }

    if (options.searchNow && !movie.hasFile) {
      await this.searchMovie(movie.id);
    }

    return movie;
  }

  public async searchMovie(movieId: number): Promise<void> {
    logger.info('Executing movie search command', {
      label: 'Radarr API',
      movieId,
    });

    try {
      await this.runCommand('MoviesSearch', { movieIds: [movieId] });
    } catch (e) {
      logger.error(
        'Something went wrong while executing Radarr movie search.',
        {
          label: 'Radarr API',
          errorMessage: e.message,
          movieId,
        }
      );
    }
  }
  public removeMovie = async (movieId: number): Promise<void> => {
    try {
      const { id, title } = await this.getMovieByTmdbId(movieId);
      await this.axios.delete(`/movie/${id}`, {
        params: {
          deleteFiles: true,
          addImportExclusion: false,
        },
      });
      logger.info(`[Radarr] Removed movie ${title}`);
    } catch (e) {
      throw new Error(`[Radarr] Failed to remove movie: ${e.message}`, {
        cause: e,
      });
    }
  };

  public clearCache = ({
    tmdbId,
    externalId,
  }: {
    tmdbId?: number | null;
    externalId?: number | null;
  }) => {
    if (tmdbId) {
      this.removeCache('/movie/lookup', {
        term: `tmdb:${tmdbId}`,
      });
    }
    if (externalId) {
      this.removeCache(`/movie/${externalId}`);
    }
  };
}

export default RadarrAPI;
