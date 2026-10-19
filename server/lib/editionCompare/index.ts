import type {
  ChaptarrEditionCard,
  ChaptarrNarratorMatrix,
  ReadarrBookLookupResult,
} from '@server/api/servarr/readarr';
import ReadarrAPI from '@server/api/servarr/readarr';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { titleSimilarity } from '@server/lib/resolve/match';
import type { ReadarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';

export type BookFormat = 'ebook' | 'audiobook';

/** A materially different edition or performance, in comparable terms. */
export interface EditionCard {
  /** Provider edition id used as the request's preferredEditionId. */
  id: string;
  /** Companion-local edition id, when the library already knows it. */
  localEditionId?: number;
  title: string;
  format: BookFormat;
  language?: string;
  narrators: string[];
  production: 'solo' | 'full-cast' | 'unknown';
  abridged: 'abridged' | 'unabridged' | 'unknown';
  durationSeconds?: number;
  publisher?: string;
  releaseDate?: string;
  imageUrl?: string;
  /** The edition the library currently tracks. */
  selected: boolean;
  /** A file for this exact edition exists. */
  owned: boolean;
  /** Fields the catalog did not provide, so the UI says "unknown". */
  unknownFields: string[];
}

export interface EditionComparison {
  format: BookFormat;
  editions: EditionCard[];
  /** True when the companion can track a second performance next to the first. */
  supportsAlongside: boolean;
  source: 'library' | 'lookup' | 'none';
}

const FULL_CAST = /full[-\s]?cast|dramati[sz]ed|multi[-\s]?cast|ensemble/i;
const ABRIDGED = /\babridged\b/i;
const UNABRIDGED = /\bunabridged\b/i;

export const classifyProduction = (
  narrators: string[],
  ...hints: (string | undefined)[]
): EditionCard['production'] => {
  if (hints.some((hint) => hint && FULL_CAST.test(hint))) return 'full-cast';
  if (narrators.length === 1) return 'solo';
  if (narrators.length >= 6) return 'full-cast';
  return 'unknown';
};

export const classifyAbridgement = (
  ...hints: (string | undefined)[]
): EditionCard['abridged'] => {
  const text = hints.filter(Boolean).join(' ');
  if (UNABRIDGED.test(text)) return 'unabridged';
  if (ABRIDGED.test(text)) return 'abridged';
  return 'unknown';
};

const unknownFieldsFor = (card: Omit<EditionCard, 'unknownFields'>) => {
  const unknown: string[] = [];
  if (card.format === 'audiobook') {
    if (!card.narrators.length) unknown.push('narrators');
    if (card.production === 'unknown') unknown.push('production');
    if (card.abridged === 'unknown') unknown.push('abridged');
    if (!card.durationSeconds) unknown.push('duration');
  }
  if (!card.language) unknown.push('language');
  if (!card.releaseDate) unknown.push('releaseDate');
  return unknown;
};

const withUnknown = (
  card: Omit<EditionCard, 'unknownFields'>
): EditionCard => ({
  ...card,
  unknownFields: unknownFieldsFor(card),
});

export const cardFromCatalog = (
  edition: ChaptarrEditionCard,
  format: BookFormat
): EditionCard =>
  withUnknown({
    id: edition.foreignEditionId ?? String(edition.editionId),
    localEditionId: edition.editionId,
    title: edition.title,
    format,
    language: edition.language,
    narrators: edition.narrators ?? [],
    production: edition.production ?? 'unknown',
    abridged: edition.abridged ?? 'unknown',
    durationSeconds: edition.durationSeconds,
    publisher: edition.publisher,
    releaseDate: edition.releaseDate,
    imageUrl: edition.imageUrl,
    selected: edition.monitored,
    owned: edition.owned,
  });

type LookupEdition = NonNullable<ReadarrBookLookupResult['editions']>[number] &
  Partial<{
    title: string;
    language: string;
    narrators: string[];
    narratorNames: string[];
    durationSeconds: number;
    publisher: string;
    releaseDate: string;
    subtitle: string;
    disambiguation: string;
    editionInfo: string;
    format: string;
    isEbook: boolean;
    images: { url?: string; remoteUrl?: string }[];
  }>;

export const cardFromLookup = (
  edition: LookupEdition,
  format: BookFormat
): EditionCard => {
  const narrators = edition.narratorNames?.length
    ? edition.narratorNames
    : (edition.narrators ?? []);
  const hints = [
    edition.title,
    edition.subtitle,
    edition.disambiguation,
    edition.editionInfo,
  ];
  return withUnknown({
    id: edition.foreignEditionId,
    title: edition.title ?? '',
    format,
    language: edition.language,
    narrators,
    production: classifyProduction(narrators, ...hints),
    abridged: classifyAbridgement(...hints),
    durationSeconds: edition.durationSeconds,
    publisher: edition.publisher,
    releaseDate: edition.releaseDate,
    imageUrl: edition.images?.[0]?.remoteUrl ?? edition.images?.[0]?.url,
    selected: edition.monitored === true,
    owned: false,
  });
};

export interface LibraryBookService {
  server: ReadarrSettings;
  bookId: number;
  format: BookFormat;
  api: ReadarrAPI;
}

export const getLibraryBookService = async (
  mediaId: number,
  format: BookFormat
): Promise<LibraryBookService | undefined> => {
  const media = await getRepository(Media).findOne({
    where: { id: mediaId, mediaType: MediaType.BOOK },
  });
  if (!media) return undefined;
  const serviceId =
    format === 'audiobook' ? media.audiobookServiceId : media.serviceId;
  const bookId =
    format === 'audiobook'
      ? media.audiobookExternalServiceId
      : media.externalServiceId;
  if (
    serviceId === null ||
    serviceId === undefined ||
    bookId === null ||
    bookId === undefined
  ) {
    return undefined;
  }
  const server = getSettings().readarr.find((entry) => entry.id === serviceId);
  if (!server) return undefined;
  return {
    server,
    bookId,
    format,
    api: new ReadarrAPI({
      apiKey: server.apiKey,
      url: ReadarrAPI.buildUrl(server, '/api/v1'),
      mediaType: format,
    }),
  };
};

export const compareBookEditions = async (options: {
  mediaId?: number;
  format: BookFormat;
  /** Lookup term (title or ISBN) for books not yet in the library. */
  term?: string;
  foreignBookId?: string;
  /** Expected title; a lookup result must match it closely. */
  title?: string;
}): Promise<EditionComparison> => {
  if (options.mediaId) {
    const service = await getLibraryBookService(
      options.mediaId,
      options.format
    );
    if (service) {
      const catalog = await service.api.getEditionCatalog(service.bookId);
      if (catalog.length) {
        return {
          format: options.format,
          editions: catalog.map((edition) =>
            cardFromCatalog(edition, options.format)
          ),
          supportsAlongside: service.api.supportsWantedEditionVariants(),
          source: 'library',
        };
      }
    }
  }

  const server = getSettings().readarr.find(
    (entry) => (entry.serviceType ?? 'ebook') === options.format
  );
  if (server && options.term) {
    const api = new ReadarrAPI({
      apiKey: server.apiKey,
      url: ReadarrAPI.buildUrl(server, '/api/v1'),
      mediaType: options.format,
    });
    const results = await api.lookupBook(options.term).catch(() => []);
    const match = options.foreignBookId
      ? results.find((entry) => entry.foreignBookId === options.foreignBookId)
      : results.find(
          (entry) =>
            !options.title || titleSimilarity(options.title, entry.title) >= 0.8
        );
    const editions = (match?.editions ?? []) as LookupEdition[];
    if (editions.length) {
      return {
        format: options.format,
        editions: editions
          .filter((edition) => !!edition.foreignEditionId)
          .map((edition) => cardFromLookup(edition, options.format)),
        supportsAlongside: api.supportsWantedEditionVariants(),
        source: 'lookup',
      };
    }
  }

  return {
    format: options.format,
    editions: [],
    supportsAlongside: false,
    source: 'none',
  };
};

export interface NarratorSeriesPlan {
  narrator: string;
  production: 'solo' | 'full-cast' | 'unknown';
  covered: number[];
  missing: number[];
  owned: number[];
  totalBooks: number;
  complete: boolean;
  /** Volumes only available in another performance. */
  otherPerformanceOnly: number[];
}

export const planSeriesWithNarrator = (
  matrix: ChaptarrNarratorMatrix
): NarratorSeriesPlan[] =>
  matrix.narrators
    .map((narrator) => {
      const missing = new Set(narrator.missingBookIds);
      const otherPerformanceOnly = matrix.books
        .filter(
          (book) =>
            missing.has(book.bookId) &&
            book.narrators.some((entry) => entry.name !== narrator.name)
        )
        .map((book) => book.bookId);
      return {
        narrator: narrator.name,
        production: narrator.production,
        covered: narrator.coveredBookIds,
        missing: narrator.missingBookIds,
        owned: narrator.ownedBookIds,
        totalBooks: matrix.totalBooks,
        complete: narrator.missingBookIds.length === 0,
        otherPerformanceOnly,
      };
    })
    .sort(
      (a, b) =>
        b.covered.length - a.covered.length ||
        a.narrator.localeCompare(b.narrator)
    );
