import { getRepository } from '@server/datasource';
import { ExternalRequestList } from '@server/entity/ExternalRequestList';
import axios from 'axios';

const HARDCOVER_GRAPHQL_URL = 'https://api.hardcover.app/v1/graphql';
const MAX_VIBE_BOOKS = 100;

export class HardcoverVibesError extends Error {
  constructor(
    message: string,
    public readonly code:
      'no-token' | 'rejected' | 'scope' | 'supporter-required' | 'unavailable'
  ) {
    super(message);
    this.name = 'HardcoverVibesError';
  }
}

export interface VibeSummary {
  id: number;
  title: string;
  description?: string | null;
  slug?: string;
  likes: number;
  owner?: string;
  /** mine, featured, or popular: why this feed is being shown. */
  source: 'mine' | 'featured' | 'popular';
  vibeType?: number;
}

export interface VibeBook {
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

export interface VibeTuning {
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
    throw new HardcoverVibesError(
      'Hardcover rejected the API token.',
      'rejected'
    );
  }
  if (response.status < 200 || response.status >= 300) {
    throw new HardcoverVibesError('Hardcover is unavailable.', 'unavailable');
  }
  const message = response.data?.errors?.[0]?.message ?? '';
  if (message) {
    if (/supporter/i.test(message)) {
      throw new HardcoverVibesError(
        'Creating vibes requires a Hardcover Supporter account.',
        'supporter-required'
      );
    }
    if (/scope|permission|not authorized|access/i.test(message)) {
      throw new HardcoverVibesError(
        'The Hardcover token needs the read:vibes scope.',
        'scope'
      );
    }
    throw new HardcoverVibesError(
      'Hardcover rejected the vibe query.',
      'unavailable'
    );
  }
  if (!response.data?.data) {
    throw new HardcoverVibesError('Hardcover returned no data.', 'unavailable');
  }
  return response.data.data;
};

interface RawVibe {
  id: number;
  title: string;
  slug?: string;
  description?: string | null;
  likes_count?: number;
  vibe_type?: number;
  user?: { username?: string } | null;
}

const toSummary = (
  vibe: RawVibe,
  source: VibeSummary['source']
): VibeSummary => ({
  id: vibe.id,
  title: vibe.title,
  description: vibe.description ?? null,
  slug: vibe.slug,
  likes: vibe.likes_count ?? 0,
  owner: vibe.user?.username,
  source,
  vibeType: vibe.vibe_type,
});

const VIBE_FIELDS = `id title slug description likes_count vibe_type user { username }`;

/** The person's own vibes, then featured and popular public feeds. */
export const listVibes = async (token: string): Promise<VibeSummary[]> => {
  const data = await gql<{
    me: { id: number }[] | { id: number };
    featured: RawVibe[];
    popular: RawVibe[];
  }>(
    token,
    `query SeerrNGVibes {
      me { id }
      featured: vibes(where: {featured: {_eq: true}}, order_by: {featured_at: desc}, limit: 12) { ${VIBE_FIELDS} }
      popular: vibes(where: {privacy_setting_id: {_eq: 1}, vibe_type: {_eq: 0}}, order_by: {likes_count: desc}, limit: 12) { ${VIBE_FIELDS} }
    }`
  );
  const meId = Array.isArray(data.me) ? data.me[0]?.id : data.me?.id;
  let mine: RawVibe[] = [];
  if (meId) {
    const own = await gql<{ vibes: RawVibe[] }>(
      token,
      `query SeerrNGMyVibes($id: Int!) {
        vibes(where: {user_id: {_eq: $id}}, order_by: {updated_at: desc}, limit: 30) { ${VIBE_FIELDS} }
      }`,
      { id: meId }
    );
    mine = own.vibes ?? [];
  }
  const seen = new Set<number>();
  const out: VibeSummary[] = [];
  for (const [list, source] of [
    [mine, 'mine'],
    [data.featured ?? [], 'featured'],
    [data.popular ?? [], 'popular'],
  ] as const) {
    for (const vibe of list) {
      if (seen.has(vibe.id)) continue;
      seen.add(vibe.id);
      out.push(toSummary(vibe, source));
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

const toBook = (book: RawBook): VibeBook => {
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
 * feed, and custom vibes need Supporter status.
 */
export const tuneBooks = (
  books: VibeBook[],
  tuning: VibeTuning
): VibeBook[] => {
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
    const scoreFor = (book: VibeBook) => {
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

export const getVibeBooks = async (
  token: string,
  vibeId: number,
  tuning: VibeTuning = {}
): Promise<{ vibe: VibeSummary; books: VibeBook[]; total: number }> => {
  const vibeData = await gql<{
    vibes_by_pk: (RawVibe & { cached_book_ids?: number[] }) | null;
  }>(
    token,
    `query SeerrNGVibe($id: Int!) {
      vibes_by_pk(id: $id) { ${VIBE_FIELDS} cached_book_ids }
    }`,
    { id: vibeId }
  );
  const vibe = vibeData.vibes_by_pk;
  if (!vibe)
    throw new HardcoverVibesError('That vibe was not found.', 'unavailable');
  const ids = (vibe.cached_book_ids ?? []).slice(0, MAX_VIBE_BOOKS);
  if (!ids.length) {
    return { vibe: toSummary(vibe, 'popular'), books: [], total: 0 };
  }
  const booksData = await gql<{ books: RawBook[] }>(
    token,
    `query SeerrNGVibeBooks($ids: [Int!]) {
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
    vibe: toSummary(vibe, 'popular'),
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
    throw new HardcoverVibesError(
      'Hardcover returned no account.',
      'unavailable'
    );
  return id;
};

export interface CustomVibeInput {
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
export const createCustomVibe = async (
  token: string,
  input: CustomVibeInput
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

  const data = await gql<{ insert_vibe: { id?: number; errors?: unknown } }>(
    token,
    `mutation SeerrNGCreateVibe($object: VibeInput!) {
      insert_vibe(object: $object) { id errors }
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
  if (!data.insert_vibe?.id) {
    throw new HardcoverVibesError(
      'Hardcover could not create that vibe.',
      /supporter/i.test(JSON.stringify(data.insert_vibe?.errors ?? ''))
        ? 'supporter-required'
        : 'unavailable'
    );
  }
  return { id: data.insert_vibe.id };
};
