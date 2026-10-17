import {
  filterSwipeCards,
  MAX_SWIPE_SOFTWARE_CURSOR_LENGTH,
  normalizeSwipeCatalogCards,
  shuffleSwipeCards,
  swipeCatalogUrl,
  type SwipeCatalogFilters,
} from '@app/components/Swipe/swipeCatalog';
import { describe, expect, it } from 'vitest';

const filters: SwipeCatalogFilters = {
  query: '',
  genre: '',
  yearFrom: '',
  yearTo: '',
  minimumRating: '',
  publisher: '',
  magazineCatalog: 'tracked',
};

describe('swipeCatalogUrl', () => {
  it.each([
    ['movie', '/api/v1/swipe/deck?mediaType=movie'],
    ['tv', '/api/v1/swipe/deck?mediaType=tv'],
    ['book', '/api/v1/swipe/deck?mediaType=book'],
  ] as const)('uses the personalized deck for %s', (mediaType, expected) => {
    expect(swipeCatalogUrl(mediaType, filters, 1, 'seed')).toBe(expected);
  });

  it('routes audiobook picks through ebook discovery with audiobook filters', () => {
    const url = new URL(
      swipeCatalogUrl(
        'audiobook',
        { ...filters, query: 'mystery', genre: 'crime', yearFrom: '2020' },
        2,
        'shuffle-a'
      ),
      'https://seerrng.invalid'
    );
    expect(url.pathname).toBe('/api/v1/discover/books');
    expect(url.searchParams.get('format')).toBe('audiobook');
    expect(url.searchParams.get('query')).toBe('mystery');
    expect(url.searchParams.get('subject')).toBe('crime');
    expect(url.searchParams.has('firstPublishYear')).toBe(false);
    expect(url.searchParams.get('page')).toBe('2');
  });

  it.each([
    ['comic', '/api/v1/discover/comics'],
    ['magazine', '/api/v1/discover/magazines'],
    ['music', '/api/v1/discover/music'],
    ['sports', '/api/v1/discover/sports'],
    ['adult', '/api/v1/adult/search'],
    ['software-retro', '/api/v1/request/software/catalog/popular'],
    ['software-modern', '/api/v1/request/software/catalog/popular'],
    ['software-game', '/api/v1/request/software/catalog/popular'],
  ] as const)('uses the existing %s catalog', (mediaType, expectedPath) => {
    const url = new URL(
      swipeCatalogUrl(
        mediaType,
        { ...filters, query: 'quiet place' },
        3,
        'seed'
      ),
      'https://seerrng.invalid'
    );
    const softwareCategory = mediaType.startsWith('software-');
    expect(url.pathname).toBe(
      softwareCategory
        ? '/api/v1/request/software/catalog/search'
        : expectedPath
    );
    expect(url.searchParams.get('page')).toBe('3');
    if (softwareCategory) {
      expect(url.searchParams.get('category')).toBe(
        mediaType.slice('software-'.length)
      );
      expect(url.searchParams.get('q')).toBe('quiet place');
      expect(url.searchParams.get('limit')).toBe('20');
    } else if (mediaType === 'magazine') {
      expect(url.searchParams.get('catalog')).toBe('tracked');
      expect(url.searchParams.get('query')).toBe('quiet place');
    } else {
      expect(url.searchParams.get('query')).toBe('quiet place');
    }
  });

  it('uses required source parameters for comics, music, and public magazines', () => {
    const comicUrl = new URL(
      swipeCatalogUrl(
        'comic',
        { ...filters, publisher: 'Vertigo', yearFrom: '1990' },
        1,
        'seed'
      ),
      'https://seerrng.invalid'
    );
    expect(comicUrl.searchParams.get('query')).toBe('*');
    expect(comicUrl.searchParams.get('publisher')).toBe('Vertigo');
    expect(comicUrl.searchParams.get('startYear')).toBe('1990');

    const musicUrl = new URL(
      swipeCatalogUrl(
        'music',
        { ...filters, genre: 'jazz', yearFrom: '1960', yearTo: '1970' },
        1,
        'seed'
      ),
      'https://seerrng.invalid'
    );
    expect(musicUrl.searchParams.get('sortBy')).toBe('ranked');
    expect(musicUrl.searchParams.get('genre')).toBe('jazz');
    expect(musicUrl.searchParams.get('primaryReleaseDateGte')).toBe(
      '1960-01-01'
    );
    expect(musicUrl.searchParams.get('primaryReleaseDateLte')).toBe(
      '1970-12-31'
    );

    const magazineUrl = new URL(
      swipeCatalogUrl(
        'magazine',
        { ...filters, magazineCatalog: 'public', query: 'science' },
        1,
        'seed'
      ),
      'https://seerrng.invalid'
    );
    expect(magazineUrl.searchParams.get('catalog')).toBe('public');
    expect(magazineUrl.searchParams.get('query')).toBe('science');
  });

  it('paginates software searches with the catalog cursor and browses popular titles without a query', () => {
    const cursor = 'x'.repeat(600);
    const searchUrl = new URL(
      swipeCatalogUrl(
        'software-retro',
        { ...filters, query: 'zelda', genre: 'adventure' },
        2,
        'seed',
        cursor
      ),
      'https://seerrng.invalid'
    );
    expect(searchUrl.pathname).toBe('/api/v1/request/software/catalog/search');
    expect(searchUrl.searchParams.get('q')).toBe('zelda');
    expect(searchUrl.searchParams.get('genre')).toBe('adventure');
    expect(searchUrl.searchParams.get('cursor')).toBe(cursor);
    expect(cursor.length).toBeLessThanOrEqual(MAX_SWIPE_SOFTWARE_CURSOR_LENGTH);

    const popularUrl = new URL(
      swipeCatalogUrl('software-retro', filters, 2, 'seed'),
      'https://seerrng.invalid'
    );
    expect(popularUrl.pathname).toBe(
      '/api/v1/request/software/catalog/popular'
    );
    expect(popularUrl.searchParams.get('offset')).toBe('20');
  });
});

describe('normalizeSwipeCatalogCards', () => {
  it.each([
    ['movie', { id: 11, title: 'Film', posterPath: '/images/film.jpg' }],
    ['tv', { id: 12, title: 'Series', posterPath: '/images/series.jpg' }],
    ['book', { id: 'OL1W', title: 'Novel', authorId: 'OL1A' }],
    ['audiobook', { id: 'OL2W', title: 'Audio', authorId: 'OL2A' }],
    [
      'comic',
      { id: '100', title: 'Volume', publisher: 'Vertigo', issueCount: 7 },
    ],
    ['magazine', { id: 'New Monthly', title: 'New Monthly', serviceId: 4 }],
    [
      'music',
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Record',
        'artist-credit': [{ name: 'Artist' }],
      },
    ],
    [
      'sports',
      {
        id: 'sportarr:123',
        title: 'League',
        requestable: true,
        libraryState: 'not-added',
      },
    ],
    [
      'adult',
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Scene',
        performers: ['Performer One'],
        serviceId: 6,
        posterPath: '/api/v1/adult/scene/cover',
      },
    ],
  ] as const)('normalizes %s catalog results', (mediaType, item) => {
    const [card] = normalizeSwipeCatalogCards(mediaType, { results: [item] });
    expect(card).toMatchObject({ mediaType, title: item.title, tags: [] });
  });

  it('keeps software request targets and omits titles without valid targets', () => {
    const retro = normalizeSwipeCatalogCards('software-retro', {
      results: [
        {
          id: 'igdb-100',
          catalogId: '100',
          igdbId: 100,
          catalogProvider: 'igdb',
          title: 'Retro Game',
          emulationSystems: [
            { slug: 'snes', name: 'Super Nintendo', group: 'retro' },
          ],
        },
        { id: 'igdb-101', title: 'No mapped system' },
      ],
    });
    expect(retro).toHaveLength(1);
    expect(retro[0].software).toMatchObject({
      category: 'retro',
      catalogId: '100',
      systems: [{ slug: 'snes', name: 'Super Nintendo' }],
    });

    const pc = normalizeSwipeCatalogCards('software-game', {
      results: [
        {
          id: 'igdb-200',
          catalogId: '200',
          igdbId: 200,
          catalogProvider: 'igdb',
          title: 'PC Game',
          platformOptions: [{ id: 6, name: 'PC (Microsoft Windows)' }],
        },
      ],
    });
    expect(pc[0].software?.pcVariants).toContainEqual({
      operatingSystem: 'windows',
      architecture: 'x64',
    });
  });

  it('drops unavailable, active-request, invalid-image, and duplicate cards', () => {
    const cards = normalizeSwipeCatalogCards('comic', {
      results: [
        { id: '1', title: 'Available', requestable: false },
        {
          id: '2',
          title: 'Already Requested',
          mediaInfo: { requestStatus: 'pending' },
        },
        { id: '3', title: 'Unsafe art', posterPath: 'javascript:alert(1)' },
        { id: '4', title: 'Once' },
        { id: '4', title: 'Duplicate' },
      ],
    });
    expect(
      cards.map(({ id, title, imageUrl }) => ({ id, title, imageUrl }))
    ).toEqual([
      { id: '3', title: 'Unsafe art', imageUrl: undefined },
      { id: '4', title: 'Once', imageUrl: undefined },
    ]);
  });
});

describe('filterSwipeCards', () => {
  const cards = normalizeSwipeCatalogCards('comic', {
    results: [
      {
        id: '1',
        title: 'Quiet Harbor',
        publisher: 'North House',
        startYear: 2012,
        genres: ['Mystery'],
        rating: 8.5,
      },
      {
        id: '2',
        title: 'Bright City',
        publisher: 'South House',
        startYear: 1992,
        genres: ['Adventure'],
        rating: 6,
      },
    ],
  });

  it('applies title, subject, year, and rating filters together', () => {
    expect(
      filterSwipeCards(cards, {
        ...filters,
        query: 'quiet',
        genre: 'myst',
        yearFrom: '2010',
        minimumRating: '8',
      }).map(({ id }) => id)
    ).toEqual(['1']);
  });

  it('keeps results unchanged when no filters are active', () => {
    expect(filterSwipeCards(cards, filters)).toHaveLength(2);
  });
});

describe('shuffleSwipeCards', () => {
  const cards = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));

  it('keeps every card and returns a repeatable order for a seed', () => {
    const first = shuffleSwipeCards(cards, 'refresh-a');
    expect(first).toEqual(shuffleSwipeCards(cards, 'refresh-a'));
    expect(first.map(({ id }) => id).sort()).toEqual(
      cards.map(({ id }) => id).sort()
    );
  });

  it('changes order when the user asks for new picks', () => {
    expect(shuffleSwipeCards(cards, 'refresh-a')).not.toEqual(
      shuffleSwipeCards(cards, 'refresh-b')
    );
  });
});
