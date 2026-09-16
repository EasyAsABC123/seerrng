import { getRepository } from '@server/datasource';
import BookSeriesWatchRequest from '@server/entity/BookSeriesWatchRequest';
import type { User } from '@server/entity/User';
import { backendScope, clientFor } from '@server/lib/bookSeries';
import { Permission, hasAutoApprovePermission } from '@server/lib/permissions';
import { runWithCurrentServarrService } from '@server/lib/serviceAdmission';
import { getSettings } from '@server/lib/settings';
import { runAuthorizedUserSecurityMutation } from '@server/lib/userSecurityMutation';
import type { BookSeriesWatchTarget } from '@server/models/BookSeries';
import AsyncLock from '@server/utils/asyncLock';

const lock = new AsyncLock();
export class SeriesWatchError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export const watchSummary = (row: BookSeriesWatchRequest) => ({
  id: row.id,
  title: row.title,
  format: row.format,
  status: row.status,
  includeExtras: row.includeExtras,
});
const withTarget = async <T>(
  target: BookSeriesWatchTarget,
  run: (
    client: ReturnType<typeof clientFor>,
    server: ReturnType<typeof getSettings>['readarr'][number]
  ) => Promise<T>
) => {
  const result = await runWithCurrentServarrService(
    'readarr',
    target.serverId,
    async (server) => {
      if (backendScope(server) !== target.scope)
        throw new SeriesWatchError(
          409,
          'The book server changed. Refresh this series.'
        );
      return run(clientFor(server), server);
    }
  );
  if (result === undefined)
    throw new SeriesWatchError(404, 'Book server not found.');
  return result;
};
const requireCapability = async (
  client: ReturnType<typeof clientFor>,
  providerId: string
) => {
  const capability = await client.getSeriesWatchCapabilities();
  if (!capability?.providers.includes(providerId.slice(0, 2) as 'hc' | 'gr'))
    throw new SeriesWatchError(
      409,
      'This book server does not support series watches.'
    );
};
export const getSeriesWatchStatus = (target: BookSeriesWatchTarget) =>
  withTarget(target, async (client) => {
    const capability = await client.getSeriesWatchCapabilities();
    if (
      !capability?.providers.includes(
        target.providerId.slice(0, 2) as 'hc' | 'gr'
      )
    )
      return { supported: false };
    const backend = await client.getSeriesWatch(target.providerId);
    const row = await getRepository(BookSeriesWatchRequest).findOneBy({
      scope: target.scope,
      providerId: target.providerId,
    });
    return {
      supported: true,
      enabled: backend.enabled,
      request: row ? watchSummary(row) : undefined,
    };
  });

const dispatch = async (row: BookSeriesWatchRequest, enabled: boolean) =>
  withTarget(row, async (client, server) => {
    await requireCapability(client, row.providerId);
    try {
      const backend = await client.setSeriesWatch(row.providerId, {
        enabled,
        includeExtras: row.includeExtras,
        rootFolder: server.activeDirectory,
        qualityProfileId: server.activeProfileId,
        metadataProfileId: server.activeMetadataProfileId ?? 0,
        searchForMissing: !server.preventSearch,
      });
      if (backend.enabled !== enabled || (enabled && backend.watchId == null))
        throw new Error('Backend did not confirm watch state.');
      row.backendWatchId = backend.watchId;
      row.status = enabled ? 'active' : 'stopped';
    } catch {
      row.status = 'failed';
      await getRepository(BookSeriesWatchRequest).save(row);
      throw new SeriesWatchError(
        503,
        'Chaptarr could not confirm the watch. Review its series watch settings and retry; a retry reuses the same watch.'
      );
    }
    await getRepository(BookSeriesWatchRequest).save(row);
    return watchSummary(row);
  });

export const requestSeriesWatch = (
  actorId: number,
  target: BookSeriesWatchTarget,
  includeExtras: boolean
) =>
  runAuthorizedUserSecurityMutation(
    actorId,
    [],
    [Permission.REQUEST, Permission.REQUEST_BOOK],
    async (actor) =>
      lock.dispatch(`${target.scope}:${target.providerId}`, async () => {
        const repository = getRepository(BookSeriesWatchRequest);
        const existing = await repository.findOneBy({
          scope: target.scope,
          providerId: target.providerId,
        });
        if (existing && !['declined', 'stopped'].includes(existing.status)) {
          if (existing.includeExtras !== includeExtras)
            throw new SeriesWatchError(
              409,
              'This series has already been requested with a different extras policy. Ask a request manager to review it.'
            );
          return watchSummary(existing);
        }
        // Read native provider identity, with no Open Library matching needed for a backend-owned watch.
        const info = await withTarget(target, async (client, server) => {
          await requireCapability(client, target.providerId);
          const title = target.providerId.startsWith('hc:')
            ? (await client.getSeriesCatalogPreview(target.providerId))?.title
            : (await client.getNativeSeriesLibrary()).entries.find(
                (entry) => entry.series.foreignSeriesId === target.providerId
              )?.series.title;
          if (!title)
            throw new SeriesWatchError(
              404,
              'Series catalog identity could not be verified.'
            );
          return { title, format: server.serviceType ?? ('ebook' as const) };
        });
        const row = repository.create({
          ...existing,
          ...target,
          ...info,
          includeExtras,
          requestedById: actor.id,
          approvedById: null,
          backendWatchId: null,
          status: 'pending',
        });
        const quota =
          actor.bookQuotaLimit ??
          getSettings().main.defaultQuotas.book.quotaLimit ??
          0;
        // Future additions cannot be charged to a finite one-time book quota; managers must approve that commitment.
        const canAutoApprove =
          actor.hasPermission(Permission.MANAGE_REQUESTS) ||
          (hasAutoApprovePermission(actor.permissions, 'book') &&
            quota === 0 &&
            !getSettings().readarr.find((s) => s.id === target.serverId)
              ?.overrideRule.length);
        if (canAutoApprove) row.approvedById = actor.id;
        await repository.save(row);
        return canAutoApprove ? dispatch(row, true) : watchSummary(row);
      })
  );

export const actOnSeriesWatch = async (
  actorId: number,
  id: number,
  action: 'approve' | 'decline' | 'stop'
) =>
  runAuthorizedUserSecurityMutation(
    actorId,
    [],
    Permission.MANAGE_REQUESTS,
    async (actor) => {
      const repository = getRepository(BookSeriesWatchRequest);
      const identity = await repository.findOneBy({ id });
      if (!identity)
        throw new SeriesWatchError(404, 'Series request not found.');
      return lock.dispatch(
        `${identity.scope}:${identity.providerId}`,
        async () => {
          const row = await repository.findOneByOrFail({ id });
          if (action === 'decline') {
            if (row.status !== 'pending')
              throw new SeriesWatchError(
                409,
                'Only pending requests can be declined. Stop an active watch instead.'
              );
            row.status = 'declined';
            await repository.save(row);
            return watchSummary(row);
          }
          row.approvedById = actor.id;
          await repository.save(row);
          return dispatch(row, action === 'approve');
        }
      );
    }
  );

export const listSeriesWatchRequests = async (user: User) =>
  (
    await getRepository(BookSeriesWatchRequest).find({
      where: user.hasPermission(Permission.MANAGE_REQUESTS)
        ? {}
        : { requestedById: user.id },
      order: { id: 'DESC' },
      take: 100,
    })
  ).map((row) => ({
    ...watchSummary(row),
    serverName: getSettings().readarr.find(
      (server) =>
        server.id === row.serverId && backendScope(server) === row.scope
    )?.name,
    destination: user.hasPermission(Permission.MANAGE_REQUESTS)
      ? (() => {
          const server = getSettings().readarr.find(
            (server) =>
              server.id === row.serverId && backendScope(server) === row.scope
          );
          return server
            ? `${server.activeProfileName} · ${server.activeDirectory}`
            : undefined;
        })()
      : undefined,
    target: {
      serverId: row.serverId,
      scope: row.scope,
      providerId: row.providerId,
    },
  }));
