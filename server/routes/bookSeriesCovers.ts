import {
  getSeriesCoverBooks,
  seriesCoverTargetSchema,
} from '@server/lib/bookSeriesCovers';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const routes = Router();
// Artwork has a separate budget so thumbnails do not exhaust series actions.
routes.use(
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `series-covers:${req.user?.id ?? 'anonymous'}`,
    skip: () => process.env.NODE_ENV === 'test',
  })
);
routes.get('/', async (req, res) => {
  const target = seriesCoverTargetSchema.safeParse(req.query);
  if (!target.success)
    return res.status(400).json({ message: 'Invalid series cover identity.' });
  try {
    const result = await getSeriesCoverBooks(target.data);
    if (!result) return res.status(404).json({ message: 'Series not found.' });
    const params = new URLSearchParams(
      Object.entries(target.data).map(([key, value]) => [key, String(value)])
    );
    return res.json({
      books: result.books.map((book, index) => ({
        title: book.title,
        position: book.position,
        ...(book.path
          ? {
              coverUrl: `/api/v1/book-series/covers/image?${params}&book=${index}`,
            }
          : {}),
      })),
    });
  } catch {
    return res.status(503).json({ message: 'Series covers unavailable.' });
  }
});
routes.get('/image', async (req, res) => {
  const { book, ...query } = req.query;
  const target = seriesCoverTargetSchema.safeParse(query);
  const index = z.coerce.number().int().min(0).max(19).safeParse(book);
  if (!target.success || !index.success) return res.status(400).end();
  try {
    const result = await getSeriesCoverBooks(target.data);
    const path = result?.books[index.data]?.path;
    if (!result || !path) return res.status(404).end();
    const cover = await result.client.getSeriesCoverImage(path);
    res.set({
      'Content-Type': cover.contentType,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(cover.imageBuffer);
  } catch {
    return res.status(404).end();
  }
});
export default routes;
