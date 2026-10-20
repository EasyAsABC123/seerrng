import { getRepository } from '@server/datasource';
import { ExternalRequestList } from '@server/entity/ExternalRequestList';
import axios from 'axios';

const HARDCOVER_GRAPHQL_URL = 'https://api.hardcover.app/v1/graphql';
const MAX_RECOMMENDED_BOOKS = 100;

export class HardcoverRecommendationsError extends Error {
  constructor(
    message: string,
    public readonly code:
      'no-token' | 'rejected' | 'scope' | 'supporter-required' | 'unavailable'
  ) {
    super(message);
    this.name = 'HardcoverRecommendationsError';
  }
}

export interface RecommendationFeed {
  id: number;
  title: string;
  description?: string | null;
  slug?: string;
  likes: number;
  owner?: string;
  /** mine, featured, or popular: why this feed is being shown. */
  source: 'mine' | 'featured' | 'popular';
  feedType?: number;
}

export interface BookRecommendation {
  id: number;
  title: string;
  slug?: string;
  author?: string;
  imageUrl?: string;
  year?: number;
  ratingsCount: number;
  series?: { name: string; position?: number | null };
  isbn13?: string;
}

export interface RecommendationTuning {
  /** Keep only books that are not part of a series. */
  standalones?: boolean;
  /** Keep standalones and the first book of each series. */
  firstInSeries?: boolean;
  /** Prefer the less-rated half of the feed. */
  lessPopular?: boolean;
  includeAuthors?: string[];
  excludeAuthors?: string[];
  /** Book ids the person wants more like, or less like, for re-ranking. */
  moreLike?: number[];
  lessLike?: number[];
}

/** Hardcover tokens live on the person's Hardcover list; never log them. */
export const getHardcoverToken = async (
  userId: number
): Promise<string | undefined> => {
  const row = await getRepository(ExternalRequestList)
    .createQueryBuilder('list')
    .addSelect('list.apiToken')
    .where('list.userId = :userId', { userId })
    .andWhere('list.provider = :provider', { provider: 'hardcover' })
    .andWhere('list.apiToken IS NOT NULL')
    .getOne();
  const token = row?.apiToken?.replace(/^Bearer\s+/i, '').trim();
  return token || undefined;
};

const gql = async <T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> => {
  const response = await axios.post<{
    data?: T;
    errors?: { message?: string }[];
  }>(
    HARDCOVER_GRAPHQL_URL,
    { query, variables },
    {
      timeout: 15_000,
      maxRedirects: 0,
      maxContentLength: 2 * 1024 * 1024,
      validateStatus: () => true,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (response.status === 401 || response.status === 403) {
    throw new HardcoverRecommendationsError(
      'Hardcover rejected the API token.',
      'rejected'
    );
  }
  if (response.status < 200 || response.status >= 300) {
    throw new HardcoverRecommendationsError(
      'Hardcover is unavailable.',
      'unavailable'
    );
  }
  const message = response.data?.errors?.[0]?.message ?? '';
  if (message) {
    if (/supporter/i.test(message)) {
      throw new HardcoverRecommendationsError(
        'Creating personalized feeds requires a Hardcover Supporter account.',
        'supporter-required'
      );
    }
    if (/scope|permission|not authorized|access/i.test(message)) {
      throw new HardcoverRecommendationsError(
        'The Hardcover token needs permission to read book recommendation feeds.',
        'scope'
      );
    }
    throw new HardcoverRecommendationsError(
      'Hardcover rejected the book recommendation query.',
      'unavailable'
    );
  }
  if (!response.data?.data) {
    throw new HardcoverRecommendationsError(
      'Hardcover returned no data.',
      'unavailable'
    );
  }
  return response.data.data;
};

// Keep Hardcover's provider-specific GraphQL field names inside this adapter.
interface RawFeed {
  id: number;
  title: string;
  slug?: string;
  description?: string | null;
  likes_count?: number;
  feedType?: number;
  user?: { username?: string } | null;
}

const toSummary = (
  feed: RawFeed,
  source: RecommendationFeed['source']
): RecommendationFeed => ({
  id: feed.id,
  title: feed.title,
  description: feed.description ?? null,
  slug: feed.slug,
  likes: feed.likes_count ?? 0,
  owner: feed.user?.username,
  source,
  feedType: feed.feedType,
});

// Keep Hardcover's provider-specific schema identifiers inside this adapter.
const FEED_FIELDS = `id title slug description likes_count feedType: vibe_type user { username }`;

/** The person's own feeds, then featured and popular public feeds. */
export const listRecommendationFeeds = async (
  token: string
): Promise<RecommendationFeed[]> => {
  const data = await gql<{
    me: { id: number }[] | { id: number };
    featured: RawFeed[];
    popular: RawFeed[];
  }>(
    token,
    `query SeerrNGBookRecommendations {
      me { id }
      featured: vibes(where: {featured: {_eq: true}}, order_by: {featured_at: desc}, limit: 12) { ${FEED_FIELDS} }
      popular: vibes(where: {privacy_setting_id: {_eq: 1}, vibe_type: {_eq: 0}}, order_by: {likes_count: desc}, limit: 12) { ${FEED_FIELDS} }
    }`
  );
  const meId = Array.isArray(data.me) ? data.me[0]?.id : data.me?.id;
  let mine: RawFeed[] = [];
  if (meId) {
    const own = await gql<{ personalFeeds: RawFeed[] }>(
      token,
      `query SeerrNGMyBookRecommendations($id: Int!) {
        personalFeeds: vibes(where: {user_id: {_eq: $id}}, order_by: {updated_at: desc}, limit: 30) { ${FEED_FIELDS} }
      }`,
      { id: meId }
    );
    mine = own.personalFeeds ?? [];
  }
  const seen = new Set<number>();
  const out: RecommendationFeed[] = [];
  for (const [list, source] of [
    [mine, 'mine'],
    [data.featured ?? [], 'featured'],
    [data.popular ?? [], 'popular'],
  ] as const) {
    for (const feed of list) {
      if (seen.has(feed.id)) continue;
      seen.add(feed.id);
      out.push(toSummary(feed, source));
    }
  }
  return out;
};

interface RawBook {
  id: number;
  title: string;
  slug?: string;
  cached_contributors?:
    { author?: { name?: string } | null; name?: string }[] | null;
  cached_image?: { url?: string } | null;
  release_year?: number | null;
  ratings_count?: number | null;
  book_series?: {
    position?: number | null;
    series?: { name?: string } | null;
  }[];
  default_physical_edition?: { isbn_13?: string | null } | null;
}

const authorOf = (book: RawBook) => {
  const first = book.cached_contributors?.[0];
  return first?.author?.name ?? first?.name;
};

const toBook = (book: RawBook): BookRecommendation => {
  const series = book.book_series?.[0];
  return {
    id: book.id,
    title: book.title,
    slug: book.slug,
    author: authorOf(book),
    imageUrl: book.cached_image?.url,
    year: book.release_year ?? undefined,
    ratingsCount: book.ratings_count ?? 0,
    series: series?.series?.name
      ? { name: series.series.name, position: series.position }
      : undefined,
    isbn13: book.default_physical_edition?.isbn_13 ?? undefined,
  };
};

const norm = (value: string) => value.trim().toLowerCase();

/**
 * Hardcover returns a ranked feed. Series position, popularity, and author
 * preferences are applied here: those are not controllable on an existing
 * feed, and personalized feeds need Supporter status.
 */
export const tuneBooks = (
  books: BookRecommendation[],
  tuning: RecommendationTuning
): BookRecommendation[] => {
  let out = books;
  if (tuning.standalones) out = out.filter((book) => !book.series);
  else if (tuning.firstInSeries) {
    out = out.filter(
      (book) => !book.series || (book.series.position ?? 0) <= 1
    );
  }
  if (tuning.includeAuthors?.length) {
    const wanted = tuning.includeAuthors.map(norm);
    out = out.filter(
      (book) => book.author && wanted.includes(norm(book.author))
    );
  }
  if (tuning.excludeAuthors?.length) {
    const blocked = tuning.excludeAuthors.map(norm);
    out = out.filter(
      (book) => !book.author || !blocked.includes(norm(book.author))
    );
  }
  if (tuning.lessPopular && out.length > 3) {
    const sorted = [...out]
      .map((book) => book.ratingsCount)
      .sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    out = out.filter((book) => book.ratingsCount <= median);
  }
  if (tuning.moreLike?.length || tuning.lessLike?.length) {
    const more = new Set(tuning.moreLike ?? []);
    const less = new Set(tuning.lessLike ?? []);
    const scoreFor = (book: BookRecommendation) => {
      let score = 0;
      for (const other of books) {
        const sameAuthor =
          !!book.author &&
          !!other.author &&
          norm(book.author) === norm(other.author);
        const sameSeries =
          !!book.series &&
          !!other.series &&
          book.series.name === other.series.name;
        if (!(sameAuthor || sameSeries) || other.id === book.id) continue;
        if (more.has(other.id)) score += 1;
        if (less.has(other.id)) score -= 1;
      }
      if (less.has(book.id)) score -= 5;
      if (more.has(book.id)) score += 5;
      return score;
    };
    out = out
      .map((book, index) => ({ book, index, score: scoreFor(book) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.book);
  }
  return out;
};

export const getRecommendedBooks = async (
  token: string,
  feedId: number,
  tuning: RecommendationTuning = {}
): Promise<{
  feed: RecommendationFeed;
  books: BookRecommendation[];
  total: number;
}> => {
  const recommendationData = await gql<{
    recommendationFeed: (RawFeed & { cached_book_ids?: number[] }) | null;
  }>(
    token,
    `query SeerrNGRecommendationFeed($id: Int!) {
      recommendationFeed: vibes_by_pk(id: $id) { ${FEED_FIELDS} cached_book_ids }
    }`,
    { id: feedId }
  );
  const feed = recommendationData.recommendationFeed;
  if (!feed)
    throw new HardcoverRecommendationsError(
      'That recommendation feed was not found.',
      'unavailable'
    );
  const ids = (feed.cached_book_ids ?? []).slice(0, MAX_RECOMMENDED_BOOKS);
  if (!ids.length) {
    return { feed: toSummary(feed, 'popular'), books: [], total: 0 };
  }
  const booksData = await gql<{ books: RawBook[] }>(
    token,
    `query SeerrNGRecommendedBooks($ids: [Int!]) {
      books(where: {id: {_in: $ids}}) {
        id title slug cached_contributors cached_image release_year ratings_count
        book_series { position series { name } }
        default_physical_edition { isbn_13 }
      }
    }`,
    { ids }
  );
  const byId = new Map((booksData.books ?? []).map((book) => [book.id, book]));
  // Hardcover's ranking is preserved; only the filters above reorder.
  const ordered = ids.flatMap((id) => {
    const book = byId.get(id);
    return book ? [toBook(book)] : [];
  });
  return {
    feed: toSummary(feed, 'popular'),
    books: tuneBooks(ordered, tuning),
    total: ordered.length,
  };
};

export const getHardcoverUserId = async (token: string): Promise<number> => {
  const data = await gql<{ me: { id: number }[] | { id: number } }>(
    token,
    'query SeerrNGMe { me { id } }'
  );
  const id = Array.isArray(data.me) ? data.me[0]?.id : data.me?.id;
  if (!id)
    throw new HardcoverRecommendationsError(
      'Hardcover returned no account.',
      'unavailable'
    );
  return id;
};

export interface PersonalizedFeedInput {
  title: string;
  description?: string;
  userId: number;
  likeBookIds?: number[];
  dislikeBookIds?: number[];
  authorIds?: number[];
  genres?: string[];
  avoidGenres?: string[];
  seriesPosition?: 'first_or_standalone' | 'standalone';
  lessPopular?: boolean;
  mood?: string;
}

/** Supporter-only on Hardcover; surfaces a clear error otherwise. */
export const createPersonalizedFeed = async (
  token: string,
  input: PersonalizedFeedInput
): Promise<{ id: number }> => {
  const signals: Record<string, unknown>[] = [
    { signal_type: 'user', value: String(input.userId), weight: 5 },
    ...(input.likeBookIds ?? []).map((id) => ({
      signal_type: 'book',
      value: String(id),
      weight: 4,
    })),
    ...(input.dislikeBookIds ?? []).map((id) => ({
      signal_type: 'book',
      value: String(id),
      weight: -4,
    })),
    ...(input.authorIds ?? []).map((id) => ({
      signal_type: 'author',
      value: String(id),
      weight: 4,
    })),
    ...(input.genres ?? []).map((value) => ({
      signal_type: 'genre',
      value,
      weight: 3,
    })),
    ...(input.avoidGenres ?? []).map((value) => ({
      signal_type: 'genre',
      value,
      weight: -5,
    })),
  ];
  if (input.seriesPosition) {
    signals.push({
      signal_type: 'series',
      value: input.seriesPosition,
      weight: 5,
    });
  }
  if (input.mood)
    signals.push({
      signal_type: 'semantic',
      value: input.mood.slice(0, 200),
      weight: 3,
    });
  if (input.lessPopular)
    signals.push({ signal_type: 'popularity', weight: -3 });
  signals.forEach((signal, index) => {
    signal.position = index;
  });

  const data = await gql<{ createdFeed: { id?: number; errors?: unknown } }>(
    token,
    `mutation SeerrNGCreateRecommendationFeed($object: VibeInput!) {
      createdFeed: insert_vibe(object: $object) { id errors }
    }`,
    {
      object: {
        title: input.title.slice(0, 120),
        description: input.description?.slice(0, 500),
        privacy_setting_id: 3,
        vibe_signals_attributes: signals,
      },
    }
  );
  if (!data.createdFeed?.id) {
    throw new HardcoverRecommendationsError(
      'Hardcover could not create that personalized feed.',
      /supporter/i.test(JSON.stringify(data.createdFeed?.errors ?? ''))
        ? 'supporter-required'
        : 'unavailable'
    );
  }
  return { id: data.createdFeed.id };
};
