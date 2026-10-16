import WhisparrAPI from '@server/api/servarr/whisparr';
import { getExternalRuntimeConfig } from '@server/lib/externalRuntimeConfig';
import { Permission } from '@server/lib/permissions';
import {
  runWithCurrentServarrService,
  runWithServarrServiceCollectionMutationAdmission,
} from '@server/lib/serviceAdmission';
import {
  allocateServarrServiceId,
  assertServarrServiceCanBeRemoved,
  getHistoricalServarrServiceIdMaximum,
} from '@server/lib/serviceId';
import type { WhisparrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { authorizedMutation } from '@server/middleware/authorizedMutation';
import { parseNonNegativeRouteId } from '@server/utils/routeId';
import { REDACTED_SECRET, redactSecrets } from '@server/utils/security';
import {
  assertServarrInstanceCapacity,
  parseServarrConnectionSettings,
  parseWhisparrSettings,
  preserveServarrApiKey,
  preserveServarrConnectionSecret,
  type ServarrConnectionSettings,
} from '@server/utils/servarrSettings';
import { Router } from 'express';

const whisparrRoutes = Router();

whisparrRoutes.get('/', (_req, res) => {
  res.status(200).json(redactSecrets(getSettings().whisparr));
});

whisparrRoutes.post(
  '/',
  authorizedMutation(Permission.ADMIN, async (req, res) => {
    const settings = getSettings();
    const parsed = parseWhisparrSettings(req.body);
    if ('error' in parsed)
      return res.status(400).json({ message: parsed.error });

    return runWithServarrServiceCollectionMutationAdmission(
      'whisparr',
      async () => {
        const historicalMaximum =
          await getHistoricalServarrServiceIdMaximum('whisparr');
        const services = await settings.persistSection(
          'whisparr',
          (current) => {
            assertServarrInstanceCapacity(current);
            const newService = {
              ...parsed.value,
              id: allocateServarrServiceId(
                current.map(({ id }) => id),
                historicalMaximum
              ),
            };
            const existing = newService.isDefault
              ? current.map((service) => ({ ...service, isDefault: false }))
              : current;
            return [...existing, newService];
          }
        );
        return res
          .status(201)
          .json(redactSecrets(services[services.length - 1]));
      }
    );
  })
);

whisparrRoutes.post<
  undefined,
  Record<string, unknown>,
  ServarrConnectionSettings
>(
  '/test',
  authorizedMutation<
    undefined,
    Record<string, unknown>,
    ServarrConnectionSettings
  >(Permission.ADMIN, async (req, res, next) => {
    try {
      const parsed = parseServarrConnectionSettings(
        preserveServarrConnectionSecret(
          req.body,
          getExternalRuntimeConfig().whisparr
        )
      );
      if ('error' in parsed)
        return res.status(400).json({ message: parsed.error });

      const api = new WhisparrAPI({
        apiKey: parsed.value.apiKey,
        url: WhisparrAPI.buildUrl(parsed.value, '/api/v3'),
      });
      const urlBase = await api
        .getSystemStatus()
        .then((value) => value.urlBase)
        .catch(() => parsed.value.baseUrl);
      const [profiles, folders, tags] = await Promise.all([
        api.getProfiles(),
        api.getRootFolders(),
        api.getTags(),
        // An empty result is expected; this verifies the scene-specific v3 API
        // surface and rejects older series-focused Whisparr instances.
        api.searchScenes('seerrng-whisparr-api-check'),
      ]).then(
        ([qualityProfiles, rootFolders, serviceTags]) =>
          [qualityProfiles, rootFolders, serviceTags] as const
      );

      return res.status(200).json({
        profiles,
        rootFolders: folders.map(({ id, path }) => ({ id, path })),
        tags,
        urlBase,
        apiVersion: 3,
      });
    } catch (e) {
      logger.error('Failed to test Whisparr', {
        label: 'Whisparr',
        message: e.message,
      });
      return next({
        status: 400,
        message:
          'Failed to connect to Whisparr scene API v3. Configure the Eros v3 branch.',
      });
    }
  })
);

whisparrRoutes.put<{ id: string }, WhisparrSettings, WhisparrSettings>(
  '/:id',
  authorizedMutation<{ id: string }, WhisparrSettings, WhisparrSettings>(
    Permission.ADMIN,
    async (req, res, next) => {
      const settings = getSettings();
      const serviceId = parseNonNegativeRouteId(req.params.id);
      if (serviceId === undefined) {
        return next({ status: 404, message: 'Settings instance not found' });
      }

      return runWithServarrServiceCollectionMutationAdmission(
        'whisparr',
        async () => {
          const current = settings.whisparr.find(({ id }) => id === serviceId);
          if (!current) {
            return next({
              status: 404,
              message: 'Settings instance not found',
            });
          }
          const parsed = parseWhisparrSettings(
            preserveServarrApiKey(req.body, current),
            current
          );
          if ('error' in parsed) {
            return next({ status: 400, message: parsed.error });
          }
          const services = await settings.persistSection('whisparr', (all) =>
            all.map((service) =>
              service.id === serviceId
                ? {
                    ...parsed.value,
                    apiKey:
                      (req.body as { apiKey?: unknown }).apiKey ===
                      REDACTED_SECRET
                        ? service.apiKey
                        : parsed.value.apiKey,
                    id: serviceId,
                  }
                : parsed.value.isDefault
                  ? { ...service, isDefault: false }
                  : service
            )
          );
          return res
            .status(200)
            .json(redactSecrets(services.find(({ id }) => id === serviceId)));
        }
      );
    }
  )
);

whisparrRoutes.get<{ id: string }>(
  '/:id/profiles',
  authorizedMutation<{ id: string }>(
    Permission.ADMIN,
    async (req, res, next) => {
      const serviceId = parseNonNegativeRouteId(req.params.id);
      if (serviceId === undefined) {
        return next({ status: 404, message: 'Settings instance not found' });
      }
      const profiles = await runWithCurrentServarrService(
        'whisparr',
        serviceId,
        async (service) =>
          new WhisparrAPI({
            apiKey: service.apiKey,
            url: WhisparrAPI.buildUrl(service, '/api/v3'),
          }).getProfiles()
      );
      if (!profiles) {
        return next({ status: 404, message: 'Settings instance not found' });
      }
      return res
        .status(200)
        .json(profiles.map(({ id, name }) => ({ id, name })));
    }
  )
);

whisparrRoutes.delete<{ id: string }>(
  '/:id',
  authorizedMutation<{ id: string }>(
    Permission.ADMIN,
    async (req, res, next) => {
      const settings = getSettings();
      const serviceId = parseNonNegativeRouteId(req.params.id);
      if (serviceId === undefined) {
        return next({ status: 404, message: 'Settings instance not found' });
      }
      return runWithServarrServiceCollectionMutationAdmission(
        'whisparr',
        async () => {
          const removed = settings.whisparr.find(({ id }) => id === serviceId);
          if (!removed) {
            return next({
              status: 404,
              message: 'Settings instance not found',
            });
          }
          await assertServarrServiceCanBeRemoved('whisparr', serviceId);
          await settings.persistSection('whisparr', (current) =>
            current.filter(({ id }) => id !== serviceId)
          );
          return res.status(200).json(redactSecrets(removed));
        }
      );
    }
  )
);

export default whisparrRoutes;
