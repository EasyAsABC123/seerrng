/** A position in a source work. Both fields are optional: catalogs vary. */
export interface SourcePosition {
  volume?: number;
  chapter?: number;
  raw: string;
}

export interface SeasonSegment {
  /** Season label such as 1 for "(S1)"; undefined when the text has none. */
  season?: number;
  position: SourcePosition;
}

const VOLUME = /\bvol(?:ume)?s?\.?\s*(\d+(?:\.\d+)?)/i;
const CHAPTER = /\bchap(?:ter)?s?\.?\s*(\d+(?:\.\d+)?)/i;
const SEASON = /\(\s*S(?:eason)?\s*(\d+)\s*\)/i;

/**
 * Parses MangaUpdates' free-text `anime.start` / `anime.end` fields, e.g.
 * `Vol 1, Chap 1 (S1) / Vol 7, Chap 61 (S2)`. Segments that mention neither a
 * volume nor a chapter are dropped rather than guessed.
 */
export const parseSeasonSegments = (
  text: string | null | undefined
): SeasonSegment[] => {
  if (!text) return [];
  const segments: SeasonSegment[] = [];
  for (const part of text.split('/')) {
    const volume = part.match(VOLUME)?.[1];
    const chapter = part.match(CHAPTER)?.[1];
    if (volume === undefined && chapter === undefined) continue;
    const season = part.match(SEASON)?.[1];
    segments.push({
      season: season === undefined ? undefined : Number(season),
      position: {
        volume: volume === undefined ? undefined : Number(volume),
        chapter: chapter === undefined ? undefined : Number(chapter),
        raw: part.trim(),
      },
    });
  }
  return segments;
};

export interface SeasonBoundary {
  /** Where the selected season stops in the source. */
  end?: SourcePosition;
  /** Where the next season (or the story) picks up, when documented. */
  next?: SourcePosition;
  /** `documented`: the catalog states it. `derived`: end + 1 chapter. */
  nextBasis?: 'documented' | 'derived';
}

/**
 * Finds the selected season's end and the continuation point. A single
 * unlabelled segment is only trusted for a one-season series; otherwise the
 * label must match. Never invents a volume for a derived continuation.
 */
export const findSeasonBoundary = (
  starts: SeasonSegment[],
  ends: SeasonSegment[],
  season: number,
  seasonCount: number
): SeasonBoundary => {
  const pick = (segments: SeasonSegment[], wanted: number) =>
    segments.find((segment) => segment.season === wanted) ??
    (seasonCount <= 1 && wanted === 1 && segments.length === 1
      ? segments[0]
      : undefined);

  const end = pick(ends, season)?.position;
  const documentedNext = pick(starts, season + 1)?.position;
  if (documentedNext) {
    return { end, next: documentedNext, nextBasis: 'documented' };
  }
  if (end?.chapter !== undefined) {
    return {
      end,
      next: {
        // The next chapter may open a new volume; the volume is not known.
        volume: undefined,
        chapter: Math.floor(end.chapter) + 1,
        raw: `Chap ${Math.floor(end.chapter) + 1}`,
      },
      nextBasis: 'derived',
    };
  }
  return { end };
};
