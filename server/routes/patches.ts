import ROMarrNGAPI from '@server/api/software/romarrng';
import type {
  PatchProject,
  PatchSearchFilters,
} from '@server/api/software/types';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const patchRoutes = Router();

patchRoutes.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => `user:${req.user?.id ?? 'anonymous'}`,
  })
);

const getApi = (): ROMarrNGAPI | undefined => {
  const settings = getSettings().softwareAcquisition.romarr;
  return settings.hostname && settings.apiKey
    ? new ROMarrNGAPI(settings)
    : undefined;
};

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() && value.length <= max
    ? value.trim()
    : undefined;

const KINDS = ['translation', 'hack', 'improvement'] as const;

/** Never let a provider claim completeness the project does not report. */
const sanitizeProject = (project: PatchProject): PatchProject => ({
  ...project,
  completeness:
    typeof project.completeness === 'number' &&
    project.completeness >= 0 &&
    project.completeness <= 1
      ? project.completeness
      : undefined,
  versions: (project.versions ?? []).slice(0, 100),
  differences: (project.differences ?? []).slice(0, 20),
});

patchRoutes.get('/search', async (req, res) => {
  const api = getApi();
  if (!api) return res.status(200).json({ available: false, results: [] });
  const kind = KINDS.find((entry) => entry === req.query.kind);
  const filters: PatchSearchFilters = {
    q: text(req.query.q, 200),
    platformSlug: text(req.query.platform, 64),
    kind,
    language: text(req.query.language, 16),
    completeOnly: req.query.completeOnly === 'true',
    catalogKey: text(req.query.catalogKey, 128),
  };
  try {
    const page = await api.searchPatchProjects(
      filters,
      24,
      text(req.query.cursor, 256)
    );
    return res.status(200).json({
      available: true,
      results: (page.results ?? []).slice(0, 48).map(sanitizeProject),
      nextCursor: page.nextCursor ?? null,
    });
  } catch (error) {
    // ROMarrNG releases before the patch catalog return 404.
    logger.debug('Patch catalog unavailable', {
      label: 'Patches',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return res.status(200).json({ available: false, results: [] });
  }
});

patchRoutes.get<{ id: string }>('/projects/:id', async (req, res) => {
  const api = getApi();
  if (!api || !/^[A-Za-z0-9][A-Za-z0-9:_.-]{0,127}$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Not found.' });
  }
  try {
    return res
      .status(200)
      .json(sanitizeProject(await api.getPatchProject(req.params.id)));
  } catch {
    return res.status(404).json({ error: 'Not found.' });
  }
});

export default patchRoutes;
