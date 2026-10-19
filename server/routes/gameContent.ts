import { getRepository } from '@server/datasource';
import Follow from '@server/entity/Follow';
import SavedDiscovery, {
  type SavedDiscoveryFilters,
} from '@server/entity/SavedDiscovery';
import {
  ensureDiscoveryFollow,
  getQuestarrOrUndefined,
  runDiscovery,
  savedDiscoverySubjectKey,
} from '@server/lib/gameDiscovery';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const gameContentRoutes = Router();

gameContentRoutes.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => `user:${req.user?.id ?? 'anonymous'}`,
  })
);

const MAX_LIST = 20;
const MAX_VALUE = 64;

const stringList = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined;
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return items
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item && item.length <= MAX_VALUE)
    .slice(0, MAX_LIST);
};

const parseFilters = (value: unknown): SavedDiscoveryFilters | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const text =
    typeof raw.text === 'string' && raw.text.length <= 200
      ? raw.text.trim()
      : undefined;
  const num = (entry: unknown, max: number) => {
    const parsed = Number(entry);
    return Number.isFinite(parsed) && parsed > 0 && parsed <= max
      ? parsed
      : undefined;
  };
  return {
    text: text || undefined,
    themes: stringList(raw.themes),
    gameModes: stringList(raw.gameModes),
    perspectives: stringList(raw.perspectives),
    genres: stringList(raw.genres),
    languages: stringList(raw.languages),
    maxHoursToBeat: num(raw.maxHoursToBeat, 2000),
    minYear: num(raw.minYear, 2100),
  };
};

const hasContent = (filters: SavedDiscoveryFilters) =>
  Object.values(filters).some((entry) =>
    Array.isArray(entry) ? entry.length : entry !== undefined
  );

const requireRequest = (
  req: Express.Request & {
    user?: { hasPermission: (p: Permission) => boolean };
  },
  res: { status: (code: number) => { json: (body: unknown) => unknown } }
) => {
  if (!req.user?.hasPermission(Permission.REQUEST)) {
    res.status(403).json({ error: 'Request access is required.' });
    return false;
  }
  return true;
};

const sanitizeGame = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Editions, included content, and standalone add-ons for one game. */
gameContentRoutes.get<{ igdbId: string }>(
  '/:igdbId/editions',
  async (req, res) => {
    const igdbId = Number(req.params.igdbId);
    if (!Number.isSafeInteger(igdbId) || igdbId <= 0) {
      return res.status(400).json({ error: 'Invalid game id.' });
    }
    const api = getQuestarrOrUndefined();
    if (!api) return res.status(200).json({ available: false });
    try {
      const editions = sanitizeGame(await api.getGameEditions(igdbId));
      return res.status(200).json({ available: true, ...editions });
    } catch (error) {
      // An older QuestarrNG has no editions route; the base request still works.
      logger.debug('Game editions unavailable', {
        label: 'Game Content',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return res.status(200).json({ available: false });
    }
  }
);

/** Ad-hoc discovery from visible filters. */
gameContentRoutes.post('/discover', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const filters = parseFilters(body.filters);
  const exclusions = parseFilters(body.exclusions);
  if (!filters || !hasContent(filters)) {
    return res.status(400).json({ error: 'Choose at least one filter.' });
  }
  try {
    const result = await runDiscovery(filters, exclusions, {
      cursor: typeof body.cursor === 'string' ? body.cursor : undefined,
    });
    if (!result) return res.status(200).json({ available: false, results: [] });
    return res.status(200).json({ available: true, ...result });
  } catch (error) {
    logger.warn('Game discovery failed', {
      label: 'Game Content',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return res.status(502).json({ error: 'Game discovery is unavailable.' });
  }
});

gameContentRoutes.get('/saved', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in.' });
  const rows = await getRepository(SavedDiscovery).find({
    where: { user: { id: req.user.id } },
    order: { createdAt: 'DESC' },
  });
  return res.status(200).json({ results: rows });
});

gameContentRoutes.post('/saved', async (req, res) => {
  if (!req.user || !requireRequest(req, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name =
    typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const filters = parseFilters(body.filters);
  const exclusions = parseFilters(body.exclusions) ?? null;
  if (!name || !filters || !hasContent(filters)) {
    return res
      .status(400)
      .json({ error: 'A name and at least one filter are required.' });
  }
  const repository = getRepository(SavedDiscovery);
  if (
    (await repository.count({ where: { user: { id: req.user.id } } })) >= 25
  ) {
    return res.status(409).json({ error: 'Saved discovery limit reached.' });
  }
  const saved = await repository.save(
    repository.create({
      user: req.user,
      name,
      mediaType: 'game',
      filters,
      exclusions,
      notify: body.notify !== false,
      knownIds: [],
    })
  );
  await ensureDiscoveryFollow(saved);
  return res.status(201).json(saved);
});

gameContentRoutes.delete<{ id: string }>('/saved/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in.' });
  const id = Number(req.params.id);
  const repository = getRepository(SavedDiscovery);
  const row = Number.isSafeInteger(id)
    ? await repository.findOne({ where: { id, user: { id: req.user.id } } })
    : null;
  if (!row) return res.status(404).json({ error: 'Not found.' });
  await getRepository(Follow).delete({
    user: { id: req.user.id },
    kind: 'saved-discovery',
    subjectKey: savedDiscoverySubjectKey(row.id),
  });
  await repository.delete({ id: row.id });
  return res.status(204).end();
});

gameContentRoutes.get<{ id: string }>('/saved/:id/run', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in.' });
  const id = Number(req.params.id);
  const row = Number.isSafeInteger(id)
    ? await getRepository(SavedDiscovery).findOne({
        where: { id, user: { id: req.user.id } },
      })
    : null;
  if (!row) return res.status(404).json({ error: 'Not found.' });
  try {
    const result = await runDiscovery(row.filters, row.exclusions, {
      cursor:
        typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });
    return res
      .status(200)
      .json(
        result
          ? { available: true, ...result }
          : { available: false, results: [] }
      );
  } catch {
    return res.status(502).json({ error: 'Game discovery is unavailable.' });
  }
});

export default gameContentRoutes;
