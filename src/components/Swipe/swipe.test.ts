import { requestBodyFor, softwareRequestBodyFor } from '@app/components/Swipe';
import {
  SWIPE_THRESHOLD,
  swipeFromDrag,
} from '@app/components/Swipe/SwipeCardView';
import type { SwipeCardData } from '@app/components/Swipe/swipeCatalog';
import { describe, expect, it } from 'vitest';

describe('swipeFromDrag', () => {
  it('needs the threshold distance', () => {
    expect(swipeFromDrag(SWIPE_THRESHOLD - 1, 0)).toBeUndefined();
    expect(swipeFromDrag(SWIPE_THRESHOLD + 1, 0)).toBe('right');
    expect(swipeFromDrag(-SWIPE_THRESHOLD - 1, 0)).toBe('left');
    expect(swipeFromDrag(0, -SWIPE_THRESHOLD - 1)).toBe('up');
  });

  it('prefers a sideways swipe when the drag is diagonal', () => {
    expect(swipeFromDrag(SWIPE_THRESHOLD + 5, -SWIPE_THRESHOLD - 5)).toBe(
      'right'
    );
    expect(swipeFromDrag(0, SWIPE_THRESHOLD + 50)).toBeUndefined();
  });
});

describe('requestBodyFor', () => {
  const profile = {
    tasteNotes: '',
    seriesRequest: 'first-season' as const,
    bookFormat: 'audiobook' as const,
    seedScope: 'full' as const,
    favoriteSeeds: [] as {
      mediaType: 'movie' | 'tv' | 'book';
      id: string;
      title: string;
    }[],
  };

  it('requests movies by TMDB ID', () => {
    expect(
      requestBodyFor(
        { mediaType: 'movie', id: '603', title: 'M', tags: [] },
        profile
      )
    ).toEqual({ mediaType: 'movie', mediaId: 603 });
  });

  it('requests the first season or every season of a series', () => {
    const card = { mediaType: 'tv' as const, id: '1396', title: 'S', tags: [] };
    expect(requestBodyFor(card, profile)).toEqual({
      mediaType: 'tv',
      mediaId: 1396,
      seasons: [1],
    });
    expect(
      requestBodyFor(card, { ...profile, seriesRequest: 'all-seasons' })
    ).toMatchObject({ seasons: 'all' });
  });

  it('requests books in the preferred format', () => {
    expect(
      requestBodyFor(
        {
          mediaType: 'book',
          id: 'OL45883W',
          title: 'B',
          authorId: 'OL1A',
          tags: [],
        },
        { ...profile, bookFormat: 'ebook' }
      )
    ).toEqual({
      mediaType: 'book',
      mediaId: 'OL45883W',
      authorId: 'OL1A',
      format: 'ebook',
    });
  });

  const requestCases: { card: SwipeCardData; expected: object }[] = [
    {
      card: {
        mediaType: 'audiobook',
        id: 'OL3W',
        title: 'Audio',
        authorId: 'OL3A',
        tags: [],
      },
      expected: {
        mediaType: 'book',
        mediaId: 'OL3W',
        authorId: 'OL3A',
        format: 'audiobook',
      },
    },
    {
      card: { mediaType: 'comic', id: '123', title: 'Comic', tags: [] },
      expected: { mediaType: 'comic', mediaId: 123 },
    },
    {
      card: {
        mediaType: 'magazine',
        id: 'The New Yorker',
        title: 'The New Yorker',
        serviceId: 4,
        tags: [],
      },
      expected: {
        mediaType: 'magazine',
        mediaId: 'The New Yorker',
        serverId: 4,
      },
    },
    {
      card: {
        mediaType: 'music',
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Record',
        tags: [],
      },
      expected: {
        mediaType: 'music',
        mediaId: '11111111-1111-4111-8111-111111111111',
      },
    },
    {
      card: {
        mediaType: 'sports',
        id: 'sportarr:league-1',
        title: 'League',
        serviceId: 8,
        tags: [],
      },
      expected: {
        mediaType: 'sports',
        mediaId: 'sportarr:league-1',
        serverId: 8,
      },
    },
    {
      card: {
        mediaType: 'adult',
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Scene',
        serviceId: 6,
        tags: [],
      },
      expected: {
        mediaType: 'adult',
        mediaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        serverId: 6,
      },
    },
  ];
  it.each(requestCases)(
    'uses the standard request contract for $card.mediaType',
    ({ card, expected }) => {
      expect(requestBodyFor(card, profile)).toEqual(expected);
    }
  );
});

describe('softwareRequestBodyFor', () => {
  it('requires a selected system for retro software', () => {
    const software = {
      category: 'retro' as const,
      catalogProvider: 'igdb' as const,
      catalogId: '100',
      igdbId: 100,
      systems: [{ slug: 'snes', name: 'Super Nintendo' }],
      pcVariants: [],
    };
    expect(softwareRequestBodyFor(software, {})).toBeUndefined();
    expect(softwareRequestBodyFor(software, { system: 'snes' })).toEqual({
      category: 'retro',
      catalogProvider: 'igdb',
      catalogId: 100,
      platformSlug: 'snes',
    });
  });

  it('sends DAT catalog keys and selected PC variants through software requests', () => {
    const datSoftware = {
      category: 'modern' as const,
      catalogProvider: 'dat' as const,
      catalogId: `dat-${'a'.repeat(64)}`,
      systems: [{ slug: 'switch', name: 'Nintendo Switch' }],
      pcVariants: [],
    };
    expect(softwareRequestBodyFor(datSoftware, { system: 'switch' })).toEqual({
      category: 'modern',
      catalogProvider: 'dat',
      catalogKey: datSoftware.catalogId,
      platformSlug: 'switch',
    });

    const game = {
      category: 'game' as const,
      catalogProvider: 'igdb' as const,
      catalogId: '200',
      igdbId: 200,
      systems: [],
      pcVariants: [
        { operatingSystem: 'windows' as const, architecture: 'x64' as const },
      ],
    };
    expect(
      softwareRequestBodyFor(game, {
        operatingSystem: 'windows',
        architecture: 'x64',
      })
    ).toEqual({
      category: 'game',
      catalogProvider: 'igdb',
      catalogId: 200,
      variant: { operatingSystem: 'windows', architecture: 'x64' },
    });
    expect(softwareRequestBodyFor(game, {})).toBeUndefined();
  });
});
