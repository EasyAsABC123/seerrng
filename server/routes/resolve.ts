import { Permission } from '@server/lib/permissions';
import {
  isLocalOcrAvailable,
  isVisionConfigured,
  resolveImage,
  resolveInput,
  type ResolveMediaType,
} from '@server/lib/resolve';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';

const resolveRoutes = Router();

resolveRoutes.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => `user:${req.user?.id ?? 'anonymous'}`,
  })
);

const MEDIA_TYPES: ResolveMediaType[] = [
  'movie',
  'tv',
  'book',
  'album',
  'artist',
  'game',
  'anime',
];

const str = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() && value.length <= max
    ? value
    : undefined;

const parseTypes = (value: unknown): ResolveMediaType[] | undefined =>
  Array.isArray(value)
    ? value.filter((entry): entry is ResolveMediaType =>
        MEDIA_TYPES.includes(entry as ResolveMediaType)
      )
    : undefined;

const parseFormat = (value: unknown) =>
  value === 'ebook' || value === 'audiobook' ? value : undefined;

const requireRequestPermission = (
  req: express.Request,
  res: express.Response
): boolean => {
  if (!req.user?.hasPermission(Permission.REQUEST)) {
    res
      .status(403)
      .json({ status: 403, message: 'Request access is required.' });
    return false;
  }
  return true;
};

/** What the share page can offer on this server. */
resolveRoutes.get('/capabilities', async (_req, res) => {
  const settings = getSettings().recognition;
  res.status(200).json({
    enabled: settings.enabled,
    links: settings.enabled,
    text: settings.enabled,
    image:
      settings.enabled &&
      ((settings.localOcr && (await isLocalOcrAvailable())) ||
        isVisionConfigured(settings)),
    localOcr: settings.localOcr && (await isLocalOcrAvailable()),
    externalVision: isVisionConfigured(settings),
    maxImageBytes: settings.maxImageBytes,
  });
});

resolveRoutes.post(
  '/',
  express.json({ limit: '64kb' }),
  async (req, res, next) => {
    if (!requireRequestPermission(req, res)) return;
    if (!getSettings().recognition.enabled) {
      return res.status(404).json({ status: 404, message: 'Not available.' });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = str(body.text, 16_000);
    const url = str(body.url, 2048);
    const isbn = str(body.isbn, 32);
    if (!text && !url && !isbn) {
      return res
        .status(400)
        .json({ status: 400, message: 'Provide text, a link, or an ISBN.' });
    }
    try {
      return res.status(200).json(
        await resolveInput({
          text,
          url,
          isbn,
          types: parseTypes(body.types),
          formatHint: parseFormat(body.formatHint),
          language: str(body.language, 16),
        })
      );
    } catch (error) {
      logger.warn('Resolve failed', {
        label: 'Resolver',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return next({ status: 503, message: 'Unable to read that input.' });
    }
  }
);

resolveRoutes.post(
  '/image',
  (req, res, next) =>
    express.raw({
      type: ['image/*', 'application/octet-stream'],
      limit: getSettings().recognition.maxImageBytes,
    })(req, res, next),
  async (req, res, next) => {
    if (!requireRequestPermission(req, res)) return;
    const settings = getSettings().recognition;
    if (!settings.enabled) {
      return res.status(404).json({ status: 404, message: 'Not available.' });
    }
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      return res.status(400).json({ status: 400, message: 'Send an image.' });
    }
    try {
      const result = await resolveImage(req.body, {
        types: parseTypes(
          req.query.types ? String(req.query.types).split(',') : undefined
        ),
        formatHint: parseFormat(req.query.formatHint),
        language: str(req.query.language, 16),
      });
      if (!result) {
        return res.status(422).json({
          status: 422,
          message:
            'This image could not be read. Enable local OCR or an image recognition provider in settings.',
        });
      }
      return res.status(200).json(result);
    } catch (error) {
      logger.warn('Image resolve failed', {
        label: 'Resolver',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return next({ status: 503, message: 'Unable to read that image.' });
    }
  }
);

export default resolveRoutes;
