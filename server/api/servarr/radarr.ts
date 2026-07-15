import logger from '@server/logger';
import { redactSecrets } from '@server/utils/security';
import ServarrBase from './base';

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
  images?: RadarrMovieImage[];
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

export interface RadarrMovieImage {
  coverType?: string;
  url?: string;
  remoteUrl?: string;
}

export type RadarrCoverImage = {
  imageBuffer: Buffer;
  contentType: string;
};

class RadarrAPI extends ServarrBase<{ movieId: number }> {
  private coverBaseUrl: string;

  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url, apiKey, cacheName: 'radarr', apiName: 'Radarr' });
    this.coverBaseUrl = RadarrAPI.buildCoverBaseUrl(url);
  }

  private static buildCoverBaseUrl(url: string): string {
    const parsedUrl = new URL(url);
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/api\/v\d+\/?$/i, '');
    parsedUrl.search = '';
    parsedUrl.hash = '';

    return parsedUrl.toString().replace(/\/$/, '');
  }

  private buildCoverUrl(path: string): string | undefined {
    if (!path.startsWith('/') || path.includes('://')) {
      return undefined;
    }

    return `${this.coverBaseUrl}${path}`;
  }

  public getMovies = async (): Promise<RadarrMovie[]> => {
    try {
      const response = await this.axios.get<RadarrMovie[]>('/movie');

      return response.data;
    } catch (e) {
      throw new Error(`[Radarr] Failed to retrieve movies: ${e.message}`, {
        cause: e,
      });
    }
  };

  public getMovie = async ({ id }: { id: number }): Promise<RadarrMovie> => {
    try {
      const response = await this.axios.get<RadarrMovie>(`/movie/${id}`);

      return response.data;
    } catch (e) {
      throw new Error(`[Radarr] Failed to retrieve movie: ${e.message}`, {
        cause: e,
      });
    }
  };

  public async getMovieCover(movieId: number): Promise<RadarrCoverImage> {
    const movie = await this.getMovie({ id: movieId }).catch(() => undefined);
    const advertisedCoverPaths = (movie?.images ?? [])
      .filter((image) => {
        const coverType = image.coverType?.toLowerCase();
        return !coverType || coverType === 'poster' || coverType === 'cover';
      })
      .map((image) => image.url)
      .filter((url): url is string => !!url && url.startsWith('/'));
    const candidatePaths = [
      ...advertisedCoverPaths,
      `/MediaCover/${movieId}/poster.jpg`,
      `/MediaCover/${movieId}/cover.jpg`,
    ];
    const uniqueCandidatePaths = [...new Set(candidatePaths)];
    let lastError: unknown;

    for (const path of uniqueCandidatePaths) {
      const coverUrl = this.buildCoverUrl(path);

      if (!coverUrl) {
        continue;
      }

      try {
        const response = await this.axios.get<ArrayBuffer>(coverUrl, {
          responseType: 'arraybuffer',
          headers: { Accept: 'image/*' },
        });
        const contentType = String(response.headers['content-type'] ?? '');

        if (!contentType.toLowerCase().startsWith('image/')) {
          throw new Error('Upstream response is not an image');
        }

        return {
          imageBuffer: Buffer.from(response.data),
          contentType,
        };
      } catch (e) {
        lastError = e;
      }
    }

    throw new Error(
      `[Radarr] Failed to retrieve cover for movie ${movieId}: ${
        lastError instanceof Error ? lastError.message : 'No cover path worked'
      }`,
      { cause: lastError }
    );
  }

  public async getMovieByTmdbId(id: number): Promise<RadarrMovie> {
    try {
      const response = await this.axios.get<RadarrMovie[]>('/movie/lookup', {
        params: {
          term: `tmdb:${id}`,
        },
      });

      if (!response.data[0]) {
        throw new Error('Movie not found');
      }

      return response.data[0];
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

        if (response.data.monitored) {
          logger.info(
            'Found existing title in Radarr and set it to monitored.',
            {
              label: 'Radarr',
              movieId: response.data.id,
              movieTitle: response.data.title,
            }
          );
          logger.debug('Radarr update details', {
            label: 'Radarr',
            movie: response.data,
          });

          if (options.searchNow) {
            this.searchMovie(response.data.id);
          }

          return response.data;
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
          this.searchMovie(movie.id);
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

      if (response.data.id) {
        logger.info('Radarr accepted request', { label: 'Radarr' });
        logger.debug('Radarr add details', {
          label: 'Radarr',
          movie: response.data,
        });
      } else {
        logger.error('Failed to add movie to Radarr', {
          label: 'Radarr',
          options,
        });
        throw new Error('Failed to add movie to Radarr');
      }
      return response.data;
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

      return response.data;
    }

    if (options.searchNow && !movie.hasFile) {
      this.searchMovie(movie.id);
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
