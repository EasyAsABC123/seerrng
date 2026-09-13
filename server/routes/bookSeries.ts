import { getSeriesDetails } from '@server/lib/bookSeries';
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
