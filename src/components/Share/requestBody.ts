import type { ResolveCandidate } from '@server/lib/resolve/types';

export type ShareFormat = 'ebook' | 'audiobook';

/** The normal media request for a confirmed candidate, or undefined if the
 * candidate opens a page instead (games, anime sources, albums by search). */
export const requestBodyForCandidate = (
  candidate: ResolveCandidate,
  options: { format: ShareFormat; seriesSeasons: 'first' | 'all' }
): Record<string, unknown> | undefined => {
  switch (candidate.mediaType) {
    case 'movie':
      return { mediaType: 'movie', mediaId: Number(candidate.id) };
    case 'tv':
      return {
        mediaType: 'tv',
        mediaId: Number(candidate.id),
        seasons: options.seriesSeasons === 'all' ? 'all' : [1],
      };
    case 'book':
      return {
        mediaType: 'book',
        mediaId: candidate.id,
        format: candidate.formatHint ?? options.format,
      };
    case 'album':
      return { mediaType: 'music', mediaId: candidate.id };
    default:
      return undefined;
  }
};
