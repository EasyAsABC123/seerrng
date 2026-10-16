import WhisparrAPI from '@server/api/servarr/whisparr';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import MediaIdentifier, {
  MediaIdentifierProvider,
} from '@server/entity/MediaIdentifier';
import { MediaRequest } from '@server/entity/MediaRequest';
import { getExternalRuntimeConfig } from '@server/lib/externalRuntimeConfig';
import { runWithServarrServiceSnapshot } from '@server/lib/serviceAdmission';
import type { WhisparrSettings } from '@server/lib/settings';
import { normalizeStashDbId } from '@server/lib/stashdbIdentity';
import logger from '@server/logger';
import { mapWithConcurrency } from '@server/utils/concurrency';
import { getHttpErrorDetails } from '@server/utils/httpError';
import { parsePositiveInt } from '@server/utils/pagination';
import { Router } from 'express';
import { In } from 'typeorm';

const adultRoutes = Router();
const RESULTS_PER_PAGE = 20;

const findAdultIdentityRows = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, MediaIdentifier>();
  const rows = await getRepository(MediaIdentifier).find({
    where: {
      provider: MediaIdentifierProvider.STASHDB,
      value: In(ids),
    },
    relations: { media: { serviceStatuses: true } },
    relationLoadStrategy: 'query',
  });
  return new Map(rows.map((row) => [row.value, row]));
};

const toResult = (
  scene: {
    foreignId: string;
    title: string;
    year?: number;
    overview?: string;
    studio?: string;
  },
  identifier?: MediaIdentifier,
  request?: { id: number; status: MediaRequestStatus },
  defaultServerId?: number
) => ({
  id: scene.foreignId,
  provider: 'whisparr' as const,
  mediaType: 'adult' as const,
  title: scene.title,
  year: scene.year,
  overview: scene.overview,
  studio: scene.studio,
  mediaInfo: identifier?.media
    ? {
        id: identifier.media.id,
        status:
          identifier.media.serviceStatuses?.find(
            (status) =>
              status.serviceType === 'whisparr' &&
              status.format === 'adult' &&
              status.serverId === defaultServerId
          )?.status ??
          (defaultServerId === undefined ||
          identifier.media.serviceId === defaultServerId
            ? (identifier.media.status ?? MediaStatus.UNKNOWN)
            : MediaStatus.UNKNOWN),
        requestStatus: request?.status,
        requestId: request?.id,
      }
    : undefined,
});

adultRoutes.get('/search', async (req, res) => {
  const query =
    typeof req.query.query === 'string' ? req.query.query.trim() : '';
  if (query.length > 200) {
    return res.status(400).json({ status: 400, message: 'Query is too long.' });
  }
  const page = parsePositiveInt(req.query.page, 1, 500);
  if (!query) {
    return res.status(200).json({
      page: 1,
      totalPages: 0,
      totalResults: 0,
      results: [],
    });
  }

  const services = getExternalRuntimeConfig().whisparr;
  const defaultServerId = services.find(({ isDefault }) => isDefault)?.id;
  let failedServices = 0;
  try {
    const resultsByService = await mapWithConcurrency(
      services,
      3,
      async (service) => {
        try {
          return await runWithServarrServiceSnapshot(
            'whisparr',
            service as WhisparrSettings,
            async (current) =>
              new WhisparrAPI({
                apiKey: current.apiKey,
                url: WhisparrAPI.buildUrl(current, '/api/v3'),
              }).searchScenes(query)
          );
        } catch (error) {
          failedServices += 1;
          logger.warn('Adult scene search failed for a Whisparr service', {
            label: 'Adult',
            serviceId: service.id,
            ...getHttpErrorDetails(error),
          });
          return [];
        }
      }
    );
    if (services.length > 0 && failedServices === services.length) {
      return res.status(503).json({
        status: 503,
        message: 'Whisparr scene search is unavailable right now.',
      });
    }

    const deduplicated = new Map<
      string,
      (typeof resultsByService)[number][number]
    >();
    for (const results of resultsByService) {
      for (const scene of results) {
        if (!deduplicated.has(scene.foreignId)) {
          deduplicated.set(scene.foreignId, scene);
        }
      }
    }
    const allResults = [...deduplicated.values()];
    const start = (page - 1) * RESULTS_PER_PAGE;
    const pageResults = allResults.slice(start, start + RESULTS_PER_PAGE);
    const identifiers = await findAdultIdentityRows(
      pageResults.map(({ foreignId }) => foreignId)
    );
    const results = await Promise.all(
      pageResults.map(async (scene) => {
        const identifier = identifiers.get(scene.foreignId);
        const activeRequest = identifier?.media
          ? await getRepository(MediaRequest).findOne({
              where: {
                media: { id: identifier.media.id },
                requestedBy: { id: req.user!.id },
                status: In([
                  MediaRequestStatus.PENDING,
                  MediaRequestStatus.APPROVED,
                ]),
              },
              select: { id: true, status: true },
            })
          : undefined;
        return toResult(scene, identifier, activeRequest, defaultServerId);
      })
    );

    return res.status(200).json({
      page,
      totalPages: Math.ceil(allResults.length / RESULTS_PER_PAGE),
      totalResults: allResults.length,
      results,
      partial: failedServices > 0,
    });
  } catch (error) {
    logger.error('Adult scene search failed', {
      label: 'Adult',
      ...getHttpErrorDetails(error),
    });
    return res.status(503).json({
      status: 503,
      message: 'Whisparr scene search is unavailable right now.',
    });
  }
});

adultRoutes.get('/:id', async (req, res) => {
  const stashDbId = normalizeStashDbId(req.params.id);
  if (!stashDbId) {
    return res
      .status(404)
      .json({ status: 404, message: 'Adult scene not found.' });
  }

  const services = getExternalRuntimeConfig().whisparr;
  const defaultServerId = services.find(({ isDefault }) => isDefault)?.id;
  try {
    const scene = await mapWithConcurrency(services, 3, async (service) => {
      try {
        return await runWithServarrServiceSnapshot(
          'whisparr',
          service as WhisparrSettings,
          async (current) =>
            new WhisparrAPI({
              apiKey: current.apiKey,
              url: WhisparrAPI.buildUrl(current, '/api/v3'),
            }).getSceneByStashDbId(stashDbId)
        );
      } catch {
        return undefined;
      }
    }).then((results) => results.find((result) => result));
    if (!scene) {
      return res
        .status(404)
        .json({ status: 404, message: 'Adult scene not found.' });
    }

    const identifiers = await findAdultIdentityRows([stashDbId]);
    const identifier = identifiers.get(stashDbId);
    const activeRequest = identifier?.media
      ? await getRepository(MediaRequest).findOne({
          where: {
            media: { id: identifier.media.id },
            requestedBy: { id: req.user!.id },
            status: In([
              MediaRequestStatus.PENDING,
              MediaRequestStatus.APPROVED,
            ]),
          },
          select: { id: true, status: true },
        })
      : undefined;
    return res
      .status(200)
      .json(toResult(scene, identifier, activeRequest, defaultServerId));
  } catch (error) {
    logger.error('Adult scene details could not be loaded', {
      label: 'Adult',
      ...getHttpErrorDetails(error),
    });
    return res.status(503).json({
      status: 503,
      message: 'Whisparr scene details are unavailable right now.',
    });
  }
});

export default adultRoutes;
