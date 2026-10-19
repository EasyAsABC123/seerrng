import TheMovieDb from '@server/api/themoviedb';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { findCandidates } from './candidates';
import {
  extractPageMetadata,
  fetchSharedPage,
  UnsafeFetchError,
} from './fetchSafe';
import { pickAutoSelected } from './match';
import {
  classifyLink,
  findIsbns,
  findUrls,
  parseTextList,
  parseTitleLine,
} from './parsers';
import type {
  ParsedItem,
  ResolveCandidate,
  ResolveGroup,
  ResolveRequest,
  ResolveResponse,
} from './types';
import { readImage, type ImageReading } from './vision';

export * from './types';
export {
  ALLOWED_IMAGE_TYPES,
  isLocalOcrAvailable,
  isVisionConfigured,
} from './vision';

const MAX_GROUPS = 40;
const GROUP_CONCURRENCY = 4;

const toGroup = (
  input: string,
  inputKind: ResolveGroup['inputKind'],
  candidates: ResolveCandidate[]
): ResolveGroup => ({
  input,
  inputKind,
  candidates,
  autoSelected: pickAutoSelected(candidates.map((c) => c.score)),
  ...(candidates.length ? {} : { note: 'no-match' as const }),
});

const tmdbCandidateFromId = async (
  type: 'movie' | 'tv',
  id: number,
  language: string | undefined,
  evidence: string
): Promise<ResolveCandidate | undefined> => {
  const tmdb = new TheMovieDb();
  try {
    if (type === 'movie') {
      const movie = await tmdb.getMovie({ movieId: id, language });
      return {
        mediaType: 'movie',
        id: String(movie.id),
        title: movie.title,
        year: Number(movie.release_date?.slice(0, 4)) || undefined,
        imageUrl: movie.poster_path
          ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
          : undefined,
        score: 1,
        confidence: 'high',
        evidence,
        source: 'tmdb',
        href: `/movie/${movie.id}`,
      };
    }
    const show = await tmdb.getTvShow({ tvId: id, language });
    return {
      mediaType: 'tv',
      id: String(show.id),
      title: show.name,
      year: Number(show.first_air_date?.slice(0, 4)) || undefined,
      imageUrl: show.poster_path
        ? `https://image.tmdb.org/t/p/w185${show.poster_path}`
        : undefined,
      score: 1,
      confidence: 'high',
      evidence,
      source: 'tmdb',
      href: `/tv/${show.id}`,
    };
  } catch {
    return undefined;
  }
};

const resolveImdb = async (imdbId: string, language?: string) => {
  const tmdb = new TheMovieDb();
  try {
    const found = await tmdb.getByExternalId({
      externalId: imdbId,
      type: 'imdb',
      language,
    });
    const movie = found.movie_results[0];
    if (movie) {
      return tmdbCandidateFromId('movie', movie.id, language, `IMDb ${imdbId}`);
    }
    const show = found.tv_results[0];
    if (show) {
      return tmdbCandidateFromId('tv', show.id, language, `IMDb ${imdbId}`);
    }
  } catch {
    // fall through to a title search
  }
  return undefined;
};

/** Reads one shared link into one or more resolved groups. */
const resolveLink = async (
  url: string,
  request: ResolveRequest
): Promise<ResolveGroup[]> => {
  const link = classifyLink(url);

  if (
    link.provider === 'tmdb' &&
    link.id &&
    (link.type === 'movie' || link.type === 'tv')
  ) {
    const candidate = await tmdbCandidateFromId(
      link.type,
      Number(link.id),
      request.language,
      'TMDB link'
    );
    return [toGroup(url, 'url', candidate ? [candidate] : [])];
  }
  if (link.provider === 'imdb' && link.id) {
    const candidate = await resolveImdb(link.id, request.language);
    if (candidate) return [toGroup(url, 'url', [candidate])];
  }
  if (
    link.provider === 'musicbrainz' &&
    link.id &&
    link.type === 'release-group'
  ) {
    return [
      toGroup(url, 'url', [
        {
          mediaType: 'album',
          id: link.id,
          title: 'MusicBrainz release',
          score: 1,
          confidence: 'high',
          evidence: 'MusicBrainz link',
          source: 'musicbrainz',
          href: `/music/${link.id}`,
        },
      ]),
    ];
  }

  // Clips and streams are identified from audio, not from the page text.
  if (link.provider === 'music-stream') {
    return [
      { input: url, inputKind: 'url', candidates: [], note: 'song-link' },
    ];
  }

  let page;
  try {
    page = await fetchSharedPage(url);
  } catch (error) {
    return [
      {
        input: url,
        inputKind: 'url',
        candidates: [],
        note:
          error instanceof UnsafeFetchError
            ? 'blocked-link'
            : 'unreadable-link',
      },
    ];
  }

  const meta = extractPageMetadata(page);
  // Letterboxd embeds the TMDB id on the film page.
  if (link.provider === 'letterboxd') {
    const tmdbId = page.match(/data-tmdb-id=["'](\d+)["']/)?.[1];
    const tmdbType = page.match(/data-tmdb-type=["'](movie|tv)["']/)?.[1] as
      'movie' | 'tv' | undefined;
    if (tmdbId) {
      const candidate = await tmdbCandidateFromId(
        tmdbType ?? 'movie',
        Number(tmdbId),
        request.language,
        'Letterboxd link'
      );
      if (candidate) return [toGroup(url, 'url', [candidate])];
    }
  }

  const isbn = meta.isbn ? findIsbns(meta.isbn)[0] : undefined;
  const title =
    meta.title
      ?.replace(
        /\s*[|\-–—]\s*(Steam|Goodreads|Amazon|Letterboxd|IMDb|Hardcover|Audible).*$/i,
        ''
      )
      .replace(/\s+on Steam$/i, '')
      .trim() ?? '';
  if (!title && !isbn) {
    return [
      { input: url, inputKind: 'url', candidates: [], note: 'unreadable-link' },
    ];
  }

  const typeHint: ParsedItem['typeHint'] =
    link.provider === 'steam' || meta.type === 'VideoGame'
      ? 'game'
      : link.provider === 'goodreads' ||
          link.provider === 'hardcover' ||
          link.provider === 'openlibrary' ||
          link.provider === 'amazon' ||
          link.provider === 'audible' ||
          meta.type === 'Book' ||
          meta.type === 'Audiobook'
        ? 'book'
        : meta.type === 'Movie'
          ? 'movie'
          : meta.type === 'TVSeries'
            ? 'tv'
            : meta.type === 'MusicAlbum'
              ? 'album'
              : undefined;

  const parsed: ParsedItem = {
    query: title,
    creator: meta.creator,
    year: meta.year,
    isbn,
    typeHint,
    evidence: `Link: ${new URL(url).hostname}`,
  };
  const formatHint =
    request.formatHint ??
    (link.provider === 'audible' ? 'audiobook' : undefined);
  const candidates = await findCandidates(parsed, { ...request, formatHint });
  return [toGroup(url, 'url', candidates)];
};

const mapWithLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    })
  );
  return results;
};

const resolveItems = async (
  items: ParsedItem[],
  inputKind: ResolveGroup['inputKind'],
  request: ResolveRequest
): Promise<ResolveGroup[]> =>
  mapWithLimit(items, GROUP_CONCURRENCY, async (item) => {
    const candidates = await findCandidates(item, request);
    return toGroup(item.isbn ?? item.evidence, inputKind, candidates);
  });

/**
 * Resolves messy input (a link, an ISBN, a pasted list) into groups of ranked
 * candidates the person confirms. Never requests anything by itself.
 */
export const resolveInput = async (
  request: ResolveRequest
): Promise<ResolveResponse> => {
  const groups: ResolveGroup[] = [];
  const text = request.text ?? '';

  const isbns = new Set<string>(request.isbn ? findIsbns(request.isbn) : []);
  for (const isbn of findIsbns(text)) isbns.add(isbn);
  for (const isbn of isbns) {
    groups.push(
      ...(await resolveItems(
        [{ query: isbn, isbn, typeHint: 'book', evidence: `ISBN ${isbn}` }],
        'isbn',
        request
      ))
    );
  }

  const urls = [
    ...new Set([...(request.url ? [request.url] : []), ...findUrls(text)]),
  ];
  for (const url of urls.slice(0, 5)) {
    try {
      groups.push(...(await resolveLink(url, request)));
    } catch (error) {
      logger.warn('Failed to resolve a shared link', {
        label: 'Resolver',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      groups.push({
        input: url,
        inputKind: 'url',
        candidates: [],
        note: 'unreadable-link',
      });
    }
  }

  const withoutIsbns = [...isbns].reduce(
    (value, isbn) => value.split(isbn).join(' '),
    text
  );
  const items = parseTextList(withoutIsbns).slice(0, MAX_GROUPS);
  groups.push(...(await resolveItems(items, 'text', request)));

  return { groups: groups.slice(0, MAX_GROUPS) };
};

/** Resolves an uploaded image: ISBNs and titles read from it. */
export const resolveImage = async (
  image: Buffer,
  request: ResolveRequest
): Promise<ResolveResponse | undefined> => {
  const reading: ImageReading | undefined = await readImage(
    getSettings().recognition,
    image
  );
  if (!reading) return undefined;

  const groups: ResolveGroup[] = [];
  const isbns = new Set<string>(
    reading.isbns.flatMap((value) => findIsbns(value))
  );
  if (reading.rawText) {
    for (const isbn of findIsbns(reading.rawText)) isbns.add(isbn);
  }
  for (const isbn of isbns) {
    groups.push(
      ...(await resolveItems(
        [{ query: isbn, isbn, typeHint: 'book', evidence: `ISBN ${isbn}` }],
        'isbn',
        request
      ))
    );
  }

  const items: ParsedItem[] = reading.items.flatMap((entry) => {
    const kind = entry.kind as ParsedItem['typeHint'];
    const parsed = parseTitleLine(entry.title);
    return parsed
      ? [
          {
            ...parsed,
            creator: entry.creator ?? parsed.creator,
            typeHint: kind ?? parsed.typeHint,
          },
        ]
      : [];
  });
  if (reading.rawText) {
    const text = [...isbns].reduce(
      (value, isbn) => value.split(isbn).join(' '),
      reading.rawText
    );
    // OCR lines are noisy: keep only plausible title-length lines.
    items.push(
      ...parseTextList(text).filter(
        (item) => item.query.length >= 3 && /[a-z]{3}/i.test(item.query)
      )
    );
  }
  groups.push(
    ...(await resolveItems(items.slice(0, MAX_GROUPS), 'image-text', request))
  );

  return {
    groups: groups.slice(0, MAX_GROUPS),
    usedExternalProvider: reading.usedExternalProvider,
  };
};
