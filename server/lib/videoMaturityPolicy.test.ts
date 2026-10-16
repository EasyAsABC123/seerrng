import type TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import { UserSettings } from '@server/entity/UserSettings';
import {
  filterVideoResultsByMaturityPolicy,
  isVideoWithinMaturityLimit,
  type UserVideoMaturityPolicy,
} from '@server/lib/videoMaturityPolicy';
import { describe, expect, it, vi } from 'vitest';

const movie = (
  ratings: { country?: string; certifications: string[] }[]
): TmdbMovieDetails =>
  ({
    release_dates: {
      results: ratings.map(({ country = 'US', certifications }) => ({
        iso_3166_1: country,
        release_dates: certifications.map((certification) => ({
          certification,
        })),
      })),
    },
  }) as TmdbMovieDetails;

const tv = (ratings: { country?: string; rating: string }[]): TmdbTvDetails =>
  ({
    content_ratings: {
      results: ratings.map(({ country = 'US', rating }) => ({
        iso_3166_1: country,
        rating,
      })),
    },
  }) as TmdbTvDetails;

describe('video maturity policy', () => {
  it('leaves titles unrestricted when no limit is configured', () => {
    expect(isVideoWithinMaturityLimit(movie([]), MediaType.MOVIE, null)).toBe(
      true
    );
    expect(isVideoWithinMaturityLimit(tv([]), MediaType.TV, undefined)).toBe(
      true
    );
  });

  it('uses only US movie ratings and rejects any release above the cap', () => {
    expect(
      isVideoWithinMaturityLimit(
        movie([
          { country: 'CA', certifications: ['R'] },
          { certifications: ['PG-13'] },
        ]),
        MediaType.MOVIE,
        'PG-13'
      )
    ).toBe(true);

    expect(
      isVideoWithinMaturityLimit(
        movie([{ certifications: ['PG', 'R'] }]),
        MediaType.MOVIE,
        'PG-13'
      )
    ).toBe(false);
  });

  it('blocks unrated, unknown, and stricter-than-limit movie metadata', () => {
    for (const details of [
      movie([]),
      movie([{ certifications: [''] }]),
      movie([{ certifications: ['Unrated'] }]),
      movie([{ certifications: ['X'] }]),
      movie([{ certifications: ['R'] }]),
    ]) {
      expect(
        isVideoWithinMaturityLimit(details, MediaType.MOVIE, 'PG-13')
      ).toBe(false);
    }
  });

  it('orders TV ratings independently from movie ratings', () => {
    expect(
      isVideoWithinMaturityLimit(
        tv([{ rating: 'TV-PG' }]),
        MediaType.TV,
        'TV-14'
      )
    ).toBe(true);
    expect(
      isVideoWithinMaturityLimit(
        tv([{ rating: 'TV-MA' }]),
        MediaType.TV,
        'TV-14'
      )
    ).toBe(false);
    expect(
      isVideoWithinMaturityLimit(
        tv([{ country: 'GB', rating: '12' }]),
        MediaType.TV,
        'TV-MA'
      )
    ).toBe(false);
  });

  it('filters discovery results and fails closed when rating metadata is unavailable', async () => {
    const tmdb = {
      getMovie: vi.fn(async ({ movieId }: { movieId: number }) => {
        if (movieId === 3) throw new Error('metadata unavailable');
        return movie([{ certifications: [movieId === 1 ? 'PG' : 'R'] }]);
      }),
    } as unknown as TheMovieDb;
    const policy: UserVideoMaturityPolicy = { movie: 'PG', tv: null };

    const filtered = await filterVideoResultsByMaturityPolicy(
      tmdb,
      policy,
      MediaType.MOVIE,
      [{ id: 1 }, { id: 2 }, { id: 3 }]
    );

    expect(filtered).toEqual([{ id: 1 }]);
    expect(tmdb.getMovie).toHaveBeenCalledTimes(3);
  });

  it('does not expose administrator-set limits in ordinary user settings payloads', () => {
    const settings = new UserSettings({
      id: 7,
      movieMaturityRatingLimit: 'PG',
      tvMaturityRatingLimit: 'TV-14',
    });

    expect(settings.filter()).not.toHaveProperty('movieMaturityRatingLimit');
    expect(settings.filter()).not.toHaveProperty('tvMaturityRatingLimit');
  });
});
