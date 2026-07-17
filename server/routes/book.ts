import OpenLibraryAPI from '@server/api/openlibrary';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { Watchlist } from '@server/entity/Watchlist';
import {
  findBookMediaForSearchDocs,
  findBookMediaForWork,
} from '@server/lib/bookMediaMatcher';
import {
  isValidOpenLibraryResourceId,
  normalizeOpenLibraryWorkId,
} from '@server/lib/externalIds';
import logger from '@server/logger';
import {
  mapOpenLibrarySearchDoc,
  mapOpenLibraryWork,
} from '@server/models/Book';
import { filterEntityResponse } from '@server/utils/entityResponse';
import { parsePositiveInt } from '@server/utils/pagination';
import { parseBoundedString } from '@server/utils/validation';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const bookRoutes = Router();
const MAX_BOOK_SEARCH_QUERY_LENGTH = 256;
const MAX_OPENLIBRARY_WORK_ID_LENGTH = 128;
export const BOOK_RATE_LIMIT = {
  windowMs: 60 * 1000,
  limit: 30,
} as const;
const bookRateLimit = rateLimit({
  ...BOOK_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () =>
    process.env.NODE_ENV === 'test' || process.env.E2E_TESTS === 'true',
  keyGenerator: (req) => `user:${req.user?.id ?? 'anonymous'}`,
});

bookRoutes.use(bookRateLimit);

const parseBookSearchQuery = (value: unknown) =>
  parseBoundedString(value, {
    fieldName: 'Query',
    maxLength: MAX_BOOK_SEARCH_QUERY_LENGTH,
  });

const parseOpenLibraryWorkId = (value: unknown) => {
  const parsed = parseBoundedString(value, {
    fieldName: 'Book ID',
    maxLength: MAX_OPENLIBRARY_WORK_ID_LENGTH,
  });
  if ('error' in parsed) {
    return parsed;
  }

  const normalized = normalizeOpenLibraryWorkId(parsed.value);
  return isValidOpenLibraryResourceId(normalized)
    ? { value: normalized }
    : { error: 'Book ID is invalid.' };
};

bookRoutes.get('/search', async (req, res, next) => {
  const parsedQuery = parseBookSearchQuery(req.query.query);
  const page = parsePositiveInt(req.query.page, 1, 500);

  if ('error' in parsedQuery) {
    return res.status(400).json({ status: 400, message: parsedQuery.error });
  }

  const query = parsedQuery.value;

  try {
    const openLibrary = new OpenLibraryAPI();
    const response = await openLibrary.searchBooks({
      query,
      page,
      limit: 20,
    });
    const mediaByOpenLibraryId = await findBookMediaForSearchDocs(
      response.docs,
      req.user
    );

    return res.status(200).json({
      page,
      totalPages: Math.max(Math.ceil(response.numFound / 20), 1),
      totalResults: response.numFound,
      results: response.docs.map((doc) =>
        mapOpenLibrarySearchDoc(
          doc,
          mediaByOpenLibraryId.get(normalizeOpenLibraryWorkId(doc.key))
        )
      ),
    });
  } catch (e) {
    logger.error('Failed to search books', {
      label: 'Book',
      errorMessage: e instanceof Error ? e.message : 'Unknown error',
      query,
    });
    return next({ status: 500, message: 'Unable to search books.' });
  }
});

bookRoutes.get('/:id', async (req, res, next) => {
  const parsedBookId = parseOpenLibraryWorkId(req.params.id);
  if ('error' in parsedBookId) {
    return res.status(404).json({ status: 404, message: 'Book not found' });
  }

  const bookId = parsedBookId.value;

  try {
    const openLibrary = new OpenLibraryAPI();
    const [work, editions, onUserWatchlist] = await Promise.all([
      openLibrary.getWork(bookId),
      openLibrary.getWorkEditions(bookId).catch(() => ({
        size: 0,
        entries: [],
      })),
      getRepository(Watchlist).exist({
        where: {
          externalId: bookId,
          mediaType: MediaType.BOOK,
          requestedBy: { id: req.user?.id },
        },
      }),
    ]);

    const media = await findBookMediaForWork(
      bookId,
      editions.entries,
      req.user
    );
    const authorId = work.authors?.[0]?.author.key.replace('/authors/', '');
    const author = authorId
      ? await openLibrary.getAuthor(authorId).catch(() => undefined)
      : undefined;

    return res
      .status(200)
      .json(
        filterEntityResponse(
          mapOpenLibraryWork(
            work,
            media,
            editions.entries,
            onUserWatchlist,
            author?.name
          ),
          req.user
        )
      );
  } catch (e) {
    logger.error('Failed to retrieve book details', {
      label: 'Book',
      errorMessage: e instanceof Error ? e.message : 'Unknown error',
      bookId,
    });
    return next({ status: 500, message: 'Unable to retrieve book details.' });
  }
});

export default bookRoutes;
