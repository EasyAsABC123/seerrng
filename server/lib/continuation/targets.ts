import ComicVineAPI from '@server/api/comicvine';
import { titleSimilarity } from '@server/lib/resolve/match';
import { getSettings } from '@server/lib/settings';
import { mapComicVineVolumeResult } from '@server/models/Comic';
import { searchBookshelfCatalogs } from '@server/utils/bookshelfCatalog';
import type { ContinuationSource } from './index';

export interface RequestTarget {
  label: 'start' | 'continuation' | 'series';
  href: string;
  title: string;
  /** False when the target is a search page, not a specific item. */
  exact: boolean;
}

const searchHref = (term: string) =>
  `/search?query=${encodeURIComponent(term)}`;

/**
 * Turns a source into request destinations that exist in this server:
 * a specific volume through the book service for novels, the ComicVine
 * volume for manga, and a search page when nothing matches.
 */
export const getRequestTargets = async (
  source: ContinuationSource
): Promise<RequestTarget[]> => {
  const targets: RequestTarget[] = [];
  const settings = getSettings();

  if (source.kind === 'novel' && source.novel && settings.readarr.length) {
    const wanted: { label: RequestTarget['label']; title?: string }[] = [
      { label: 'start', title: source.novel.volumes[0]?.title },
      { label: 'continuation', title: source.novel.continuationVolume?.title },
    ];
    for (const entry of wanted) {
      if (!entry.title) continue;
      const results = await searchBookshelfCatalogs(
        settings.readarr,
        entry.title,
        undefined
      ).catch(() => []);
      const best = results
        .map((book) => ({
          book,
          score: titleSimilarity(entry.title ?? '', book.title),
        }))
        .sort((a, b) => b.score - a.score)[0];
      targets.push(
        best && best.score >= 0.7
          ? {
              label: entry.label,
              href: `/book/${encodeURIComponent(best.book.id)}`,
              title: best.book.title,
              exact: true,
            }
          : {
              label: entry.label,
              href: searchHref(entry.title),
              title: entry.title,
              exact: false,
            }
      );
    }
  }

  if (source.kind === 'manga') {
    const { comicVineApiKey } = settings.main;
    if (comicVineApiKey) {
      try {
        const response = await new ComicVineAPI(comicVineApiKey).searchVolumes({
          query: source.title,
          limit: 5,
        });
        const volumes = (response.results ?? []).map((volume) =>
          mapComicVineVolumeResult(volume)
        );
        const best = volumes
          .map((volume) => ({
            volume,
            score: titleSimilarity(source.title, volume.title),
          }))
          .sort((a, b) => b.score - a.score)[0];
        if (best && best.score >= 0.7) {
          targets.push({
            label: 'series',
            href: `/comic/${best.volume.id}`,
            title: best.volume.title,
            exact: true,
          });
        }
      } catch {
        // fall through to the search page
      }
    }
  }

  if (!targets.length) {
    targets.push({
      label: 'series',
      href: searchHref(source.searchTerm || source.title),
      title: source.title,
      exact: false,
    });
  }
  return targets;
};
