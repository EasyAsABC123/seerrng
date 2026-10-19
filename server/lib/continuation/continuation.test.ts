import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSeasonChain,
  findSeasonBoundary,
  parseSeasonSegments,
} from '@server/lib/continuation';

// Real MangaUpdates text for Sousou no Frieren.
const START = 'Vol 1, Chap 1 (S1) / Vol 7, Chap 61 (S2)';
const END = 'Vol 7, Chap 60 (S1) / Vol 9, Chap 80 (S2)';

describe('parseSeasonSegments', () => {
  it('reads per-season volume and chapter', () => {
    const segments = parseSeasonSegments(END);
    assert.equal(segments.length, 2);
    assert.deepEqual(segments[0].position, {
      volume: 7,
      chapter: 60,
      raw: 'Vol 7, Chap 60 (S1)',
    });
    assert.equal(segments[1].season, 2);
  });

  it('drops segments that name neither volume nor chapter', () => {
    assert.deepEqual(parseSeasonSegments('Ongoing'), []);
    assert.deepEqual(parseSeasonSegments(null), []);
    assert.deepEqual(parseSeasonSegments(''), []);
  });

  it('accepts spelled-out and abbreviated forms', () => {
    const [segment] = parseSeasonSegments('Volume 3, Chapter 12.5');
    assert.equal(segment.position.volume, 3);
    assert.equal(segment.position.chapter, 12.5);
  });
});

describe('findSeasonBoundary', () => {
  const starts = parseSeasonSegments(START);
  const ends = parseSeasonSegments(END);

  it('uses the documented start of the next season', () => {
    const boundary = findSeasonBoundary(starts, ends, 1, 2);
    assert.equal(boundary.nextBasis, 'documented');
    assert.equal(boundary.end?.volume, 7);
    assert.equal(boundary.end?.chapter, 60);
    assert.equal(boundary.next?.volume, 7);
    assert.equal(boundary.next?.chapter, 61);
  });

  it('derives only the next chapter when the next start is not documented', () => {
    const boundary = findSeasonBoundary(starts, ends, 2, 2);
    assert.equal(boundary.nextBasis, 'derived');
    assert.equal(boundary.next?.chapter, 81);
    // The volume holding chapter 81 is not documented, so none is claimed.
    assert.equal(boundary.next?.volume, undefined);
  });

  it('does not guess when the selected season is not documented', () => {
    const boundary = findSeasonBoundary(starts, ends, 3, 3);
    assert.equal(boundary.end, undefined);
    assert.equal(boundary.next, undefined);
    assert.equal(boundary.nextBasis, undefined);
  });

  it('trusts an unlabelled segment only for a single-season series', () => {
    const single = parseSeasonSegments('Vol 2, Chap 9');
    assert.equal(findSeasonBoundary([], single, 1, 1).end?.chapter, 9);
    assert.equal(findSeasonBoundary([], single, 1, 2).end, undefined);
  });
});

describe('buildSeasonChain', () => {
  const media = (
    id: number,
    edges: { type: string; to: number; format?: string }[]
  ) => ({
    id,
    format: 'TV' as const,
    relations: {
      edges: edges.map((edge) => ({
        relationType: edge.type as 'PREQUEL' | 'SEQUEL',
        node: {
          id: edge.to,
          type: 'ANIME' as const,
          format: (edge.format ?? 'TV') as 'TV',
        },
      })),
    },
  });
  const graph = new Map([
    [1, media(1, [{ type: 'SEQUEL', to: 2 }])],
    [
      2,
      media(2, [
        { type: 'PREQUEL', to: 1 },
        { type: 'SEQUEL', to: 3 },
        { type: 'SEQUEL', to: 9, format: 'MOVIE' },
      ]),
    ],
    [3, media(3, [{ type: 'PREQUEL', to: 2 }])],
  ]);
  const anilist = {
    getMediaWithRelations: async (id: number) => graph.get(id) ?? null,
  };

  it('orders seasons from any starting point and skips non-TV entries', async () => {
    const chain = await buildSeasonChain(anilist, graph.get(2)!);
    assert.deepEqual(
      chain.map((entry) => entry.id),
      [1, 2, 3]
    );
  });
});
