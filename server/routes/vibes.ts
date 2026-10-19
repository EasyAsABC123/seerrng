import {
  createCustomVibe,
  getHardcoverToken,
  getHardcoverUserId,
  getVibeBooks,
  HardcoverVibesError,
  listVibes,
  type VibeTuning,
} from '@server/lib/hardcoverVibes';
import logger from '@server/logger';
import type { Response } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const vibeRoutes = Router();

vibeRoutes.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => `user:${req.user?.id ?? 'anonymous'}`,
  })
);

const respondError = (res: Response, error: unknown) => {
  if (error instanceof HardcoverVibesError) {
    const status =
      error.code === 'no-token'
        ? 200
        : error.code === 'supporter-required'
          ? 403
          : error.code === 'unavailable'
            ? 502
            : 400;
    return res
      .status(status)
      .json({ available: false, code: error.code, error: error.message });
  }
  logger.warn('Hardcover vibes failed', {
    label: 'Vibes',
    errorMessage: error instanceof Error ? error.message : String(error),
  });
  return res.status(502).json({
    available: false,
    code: 'unavailable',
    error: 'Hardcover is unavailable.',
  });
};

const ids = (value: unknown): number[] | undefined =>
  Array.isArray(value)
    ? value
        .map(Number)
        .filter((entry) => Number.isSafeInteger(entry) && entry > 0)
        .slice(0, 50)
    : undefined;

const names = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value
        .filter(
          (entry): entry is string =>
            typeof entry === 'string' && entry.length <= 120
        )
        .slice(0, 20)
    : undefined;

const parseTuning = (value: unknown): VibeTuning => {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    standalones: raw.standalones === true,
    firstInSeries: raw.firstInSeries === true,
    lessPopular: raw.lessPopular === true,
    includeAuthors: names(raw.includeAuthors),
    excludeAuthors: names(raw.excludeAuthors),
    moreLike: ids(raw.moreLike),
    lessLike: ids(raw.lessLike),
  };
};

vibeRoutes.get('/', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in.' });
  const token = await getHardcoverToken(req.user.id);
  if (!token) {
    return res
      .status(200)
      .json({ available: false, code: 'no-token', results: [] });
  }
  try {
    return res
      .status(200)
      .json({ available: true, results: await listVibes(token) });
  } catch (error) {
    return respondError(res, error);
  }
});

vibeRoutes.post<{ id: string }>('/:id/books', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in.' });
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid vibe.' });
  }
  const token = await getHardcoverToken(req.user.id);
  if (!token) {
    return res
      .status(200)
      .json({ available: false, code: 'no-token', books: [] });
  }
  try {
    return res.status(200).json({
      available: true,
      ...(await getVibeBooks(token, id, parseTuning(req.body?.tuning))),
    });
  } catch (error) {
    return respondError(res, error);
  }
});

/** Supporter-only. Hardcover enforces it; we pass its answer through. */
vibeRoutes.post('/', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in.' });
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return res.status(400).json({ error: 'A title is required.' });
  }
  const token = await getHardcoverToken(req.user.id);
  if (!token)
    return res.status(200).json({ available: false, code: 'no-token' });
  try {
    const hardcoverUserId = await getHardcoverUserId(token);
    const created = await createCustomVibe(token, {
      title,
      description:
        typeof body.description === 'string' ? body.description : undefined,
      userId: hardcoverUserId,
      likeBookIds: ids(body.likeBookIds),
      dislikeBookIds: ids(body.dislikeBookIds),
      authorIds: ids(body.authorIds),
      genres: names(body.genres),
      avoidGenres: names(body.avoidGenres),
      seriesPosition:
        body.seriesPosition === 'standalone' ||
        body.seriesPosition === 'first_or_standalone'
          ? body.seriesPosition
          : undefined,
      lessPopular: body.lessPopular === true,
      mood: typeof body.mood === 'string' ? body.mood : undefined,
    });
    return res.status(201).json(created);
  } catch (error) {
    return respondError(res, error);
  }
});

export default vibeRoutes;
