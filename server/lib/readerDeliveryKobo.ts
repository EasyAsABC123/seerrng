import type { ReaderGroupingTargetType } from '@server/api/readerDelivery';
import {
  buildReaderGroupingFilter,
  ReaderDeliveryApi,
} from '@server/api/readerDelivery';
import { getRepository } from '@server/datasource';
import ReaderDeliveryGrouping from '@server/entity/ReaderDeliveryGrouping';
import {
  defaultReaderDeliverySettings,
  getSettings,
} from '@server/lib/settings';
import axios from 'axios';

export const BOOKORBIT_KOBO_COLLECTION_MARKER =
  'Managed by SeerrNG for live-rule Kobo sync.';

const getKoboCollectionName = (grouping: ReaderDeliveryGrouping): string => {
  const typeLabel =
    grouping.targetType === 'author'
      ? 'Author'
      : grouping.targetType === 'comic-series'
        ? 'Comic Series'
        : 'Book Series';
  const hash = grouping.groupName.match(/\[([a-f0-9]{12})\]$/i)?.[1];
  const prefix = 'SeerrNG Kobo · ' + typeLabel + ' · ';
  const suffix = hash ? ' [' + hash + ']' : '';
  return (
    prefix +
    grouping.targetName.slice(0, 255 - prefix.length - suffix.length) +
    suffix
  );
};

const getSafeKoboSyncError = (error: unknown): string => {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401 || status === 403) {
    return 'BookOrbit rejected the account or it cannot manage Collections. Check the account credentials and permissions.';
  }
  if (status === 404) {
    return 'BookOrbit could not find the managed Kobo Collection. SeerrNG will try to recreate it on the next sync.';
  }
  if (
    status === 413 ||
    (axios.isAxiosError(error) && error.code === 'ERR_BAD_RESPONSE')
  ) {
    return 'BookOrbit returned a response that was too large to process safely.';
  }
  return 'SeerrNG could not sync the managed Kobo Collection in BookOrbit. Check the service address and account permissions.';
};

export const ensureBookOrbitKoboCollection = async (
  api: ReaderDeliveryApi,
  token: string,
  grouping: ReaderDeliveryGrouping
): Promise<string> => {
  const name = getKoboCollectionName(grouping);
  const definition = {
    name,
    description:
      BOOKORBIT_KOBO_COLLECTION_MARKER +
      ' SeerrNG updates its membership from the linked live reader shelf.',
    isPublic: grouping.isPublic,
    syncToKobo: grouping.syncToKobo,
  };
  let id = grouping.remoteKoboCollectionId ?? undefined;

  if (!id) {
    id = await api.findBookOrbitCollectionIdByName(
      token,
      name,
      BOOKORBIT_KOBO_COLLECTION_MARKER
    );
  }

  if (id) {
    try {
      return await api.saveBookOrbitCollection(token, { ...definition, id });
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        throw error;
      }
      const recoveredId = await api.findBookOrbitCollectionIdByName(
        token,
        name,
        BOOKORBIT_KOBO_COLLECTION_MARKER
      );
      if (recoveredId) {
        return api.saveBookOrbitCollection(token, {
          ...definition,
          id: recoveredId,
        });
      }
    }
  }

  return api.saveBookOrbitCollection(token, definition);
};

export const reconcileBookOrbitKoboCollection = async (
  api: ReaderDeliveryApi,
  token: string,
  collectionId: string,
  target: {
    type: ReaderGroupingTargetType;
    id: string;
    name: string;
  }
): Promise<number> => {
  const filter = buildReaderGroupingFilter('bookorbit', target);
  const [matchedIds, currentIds] = await Promise.all([
    api.getBookOrbitMatchedBookIds(token, filter),
    api.getBookOrbitCollectionBookIds(token, collectionId),
  ]);
  const matched = new Set(matchedIds);
  const current = new Set(currentIds);
  const additions = matchedIds.filter((id) => !current.has(id));
  const removals = currentIds.filter((id) => !matched.has(id));

  // Add first so a failed removal leaves the collection complete; the next
  // run will retry stale removals from the current BookOrbit membership.
  if (additions.length > 0) {
    await api.changeBookOrbitCollectionBooks(
      token,
      collectionId,
      'add',
      additions
    );
  }
  if (removals.length > 0) {
    await api.changeBookOrbitCollectionBooks(
      token,
      collectionId,
      'remove',
      removals
    );
  }
  return matched.size;
};

export const syncBookOrbitKoboGrouping = async (
  api: ReaderDeliveryApi,
  token: string,
  grouping: ReaderDeliveryGrouping,
  saveGrouping: (
    grouping: ReaderDeliveryGrouping
  ) => Promise<ReaderDeliveryGrouping>
): Promise<{ warning?: string }> => {
  if (grouping.provider !== 'bookorbit') return {};

  if (!grouping.syncToKobo && !grouping.remoteKoboCollectionId) {
    grouping.koboSyncStatus = 'disabled';
    grouping.koboSyncError = null;
    grouping.lastKoboSyncedAt = null;
    await saveGrouping(grouping);
    return {};
  }

  try {
    const collectionId = await ensureBookOrbitKoboCollection(
      api,
      token,
      grouping
    );
    grouping.remoteKoboCollectionId = collectionId;
    grouping.koboSyncStatus = grouping.syncToKobo ? 'pending' : 'disabled';
    grouping.koboSyncError = null;
    await saveGrouping(grouping);

    if (grouping.syncToKobo) {
      await reconcileBookOrbitKoboCollection(api, token, collectionId, {
        type: grouping.targetType,
        id: grouping.targetId,
        name: grouping.targetName,
      });
      grouping.koboSyncStatus = 'ready';
      grouping.lastKoboSyncedAt = new Date();
    } else {
      grouping.koboSyncStatus = 'disabled';
    }
    grouping.koboSyncError = null;
    await saveGrouping(grouping);
    return {};
  } catch (error) {
    const warning = getSafeKoboSyncError(error);
    grouping.koboSyncStatus = 'error';
    grouping.koboSyncError = warning;
    await saveGrouping(grouping);
    return { warning };
  }
};

export const syncBookOrbitKoboCollections = async (): Promise<void> => {
  const repository = getRepository(ReaderDeliveryGrouping);
  const groupings = await repository.find({
    where: { provider: 'bookorbit' },
    order: { updatedAt: 'ASC', id: 'ASC' },
  });
  const eligible = groupings.filter((grouping) => {
    if (!grouping.remoteGroupId) return false;
    if (
      !grouping.syncToKobo &&
      (grouping.koboSyncStatus !== 'error' || !grouping.remoteKoboCollectionId)
    ) {
      return false;
    }
    return !(
      grouping.status === 'pending' &&
      grouping.updatedAt &&
      Date.now() - new Date(grouping.updatedAt).getTime() < 2 * 60 * 1000
    );
  });
  if (eligible.length === 0) return;

  const settings =
    getSettings().readerDelivery ?? defaultReaderDeliverySettings();
  if (
    !settings.bookorbitUrl ||
    !settings.bookorbitUsername ||
    !settings.bookorbitPassword
  ) {
    const warning =
      'Add the BookOrbit address and an account with Collection management access in Settings > Services > Reader Apps.';
    for (const grouping of eligible) {
      grouping.koboSyncStatus = 'error';
      grouping.koboSyncError = warning;
      await repository.save(grouping);
    }
    return;
  }

  const api = new ReaderDeliveryApi(settings.bookorbitUrl);
  let token: string;
  try {
    token = await api.login('bookorbit', {
      username: settings.bookorbitUsername,
      password: settings.bookorbitPassword,
    });
  } catch (error) {
    const warning = getSafeKoboSyncError(error);
    for (const grouping of eligible) {
      grouping.koboSyncStatus = 'error';
      grouping.koboSyncError = warning;
      await repository.save(grouping);
    }
    return;
  }

  for (const grouping of eligible) {
    await syncBookOrbitKoboGrouping(api, token, grouping, (value) =>
      repository.save(value)
    );
  }
};
