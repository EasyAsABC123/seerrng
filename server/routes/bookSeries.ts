import { getSeriesDetails } from '@server/lib/bookSeries';
import {
  getBookSeriesPreview,
  searchBookSeries,
} from '@server/lib/bookSeriesSearch';
import { filterEntityResponse } from '@server/utils/entityResponse';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const bookSeriesRoutes = Router();
bookSeriesRoutes.use(
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user?.id ?? 'anonymous'}`,
    skip: () =>
      process.env.NODE_ENV === 'test' || process.env.E2E_TESTS === 'true',
  })
);
bookSeriesRoutes.get('/search', async (req, res) => {
  const { query, format } = req.query;
  if (
    typeof query !== 'string' ||
    query.trim().length < 2 ||
    query.trim().length > 200 ||
    (format !== undefined && format !== 'ebook' && format !== 'audiobook')
  ) {
    return res.status(400).json({
      message:
        'Enter a series name between 2 and 200 characters and a supported format.',
    });
  }
  try {
    return res.json(await searchBookSeries(query.trim(), format));
  } catch {
    return res.status(503).json({
      message: 'Book series search is unavailable. Please try again later.',
    });
  }
});
bookSeriesRoutes.get('/catalog', async (req, res) => {
  const { serverId, scope, providerId } = req.query;
  if (
    typeof serverId !== 'string' ||
    !/^[1-9]\d*$/.test(serverId) ||
    !Number.isSafeInteger(Number(serverId)) ||
    typeof scope !== 'string' ||
    scope.length > 256 ||
    typeof providerId !== 'string' ||
    providerId.length > 128 ||
    !/^hc:[1-9]\d*$/.test(providerId)
  ) {
    return res
      .status(400)
      .json({ message: 'Invalid series catalog identity.' });
  }
  try {
    const preview = await getBookSeriesPreview(
      Number(serverId),
      scope,
      providerId,
      req.user
    );
    if (!preview)
      return res.status(404).json({ message: 'Series catalog not found.' });
    return res.json(preview);
  } catch {
    return res.status(503).json({
      message: 'The series preview is unavailable. Please try again later.',
    });
  }
});
bookSeriesRoutes.get('/:id', async (req, res) => {
  if (
    !/^[1-9]\d*$/.test(req.params.id) ||
    !Number.isSafeInteger(Number(req.params.id))
  ) {
    return res.status(400).json({ message: 'Invalid series ID.' });
  }
  try {
    const series = await getSeriesDetails(Number(req.params.id), req.user);
    if (!series) return res.status(404).json({ message: 'Series not found.' });
    return res.json(filterEntityResponse(series, req.user));
  } catch {
    return res.status(503).json({
      message: 'Book series metadata is unavailable. Please try again later.',
    });
  }
});
export default bookSeriesRoutes;
