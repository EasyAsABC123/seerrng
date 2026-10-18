import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ReaderDeliveryApi } from '@server/api/readerDelivery';
import ReaderDeliveryGrouping from '@server/entity/ReaderDeliveryGrouping';
import {
  BOOKORBIT_KOBO_COLLECTION_MARKER,
  syncBookOrbitKoboGrouping,
} from './readerDeliveryKobo';

const createGrouping = (init: Partial<ReaderDeliveryGrouping> = {}) =>
  new ReaderDeliveryGrouping({
    id: 1,
    provider: 'bookorbit',
    targetType: 'book-series',
    targetId: 'series:42',
    targetName: 'The Broken Earth',
    groupName: 'SeerrNG · Book Series · The Broken Earth [123456789abc]',
    remoteGroupId: 'scope-42',
    remoteKoboCollectionId: null,
    isPublic: true,
    syncToKobo: true,
    koboSyncStatus: 'pending',
    koboSyncError: null,
    status: 'ready',
    lastMatchCount: 2,
    countVerified: true,
    lastError: null,
    lastSyncedAt: new Date(),
    lastKoboSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...init,
  });

describe('BookOrbit Kobo Collection sync', () => {
  it('creates a managed native Collection and reconciles additions and removals', async () => {
    const grouping = createGrouping();
    const changes: { action: string; ids: number[] }[] = [];
    const savedStates: string[] = [];
    const api = {
      findBookOrbitCollectionIdByName: async (
        _token: string,
        name: string,
        marker: string
      ) => {
        assert.match(name, /^SeerrNG Kobo · Book Series · /);
        assert.equal(marker, BOOKORBIT_KOBO_COLLECTION_MARKER);
        return undefined;
      },
      saveBookOrbitCollection: async (
        _token: string,
        definition: {
          name: string;
          description: string;
          isPublic: boolean;
          syncToKobo: boolean;
        }
      ) => {
        assert.match(definition.description, /^Managed by SeerrNG/);
        assert.equal(definition.syncToKobo, true);
        return 'collection-42';
      },
      getBookOrbitMatchedBookIds: async () => [1, 2],
      getBookOrbitCollectionBookIds: async () => [2, 3],
      changeBookOrbitCollectionBooks: async (
        _token: string,
        _collectionId: string,
        action: string,
        ids: number[]
      ) => {
        changes.push({ action, ids });
      },
    } as unknown as ReaderDeliveryApi;

    const result = await syncBookOrbitKoboGrouping(
      api,
      'token',
      grouping,
      async (value) => {
        savedStates.push(value.koboSyncStatus);
        return value;
      }
    );

    assert.deepEqual(result, {});
    assert.deepEqual(changes, [
      { action: 'add', ids: [1] },
      { action: 'remove', ids: [3] },
    ]);
    assert.equal(grouping.remoteKoboCollectionId, 'collection-42');
    assert.equal(grouping.koboSyncStatus, 'ready');
    assert.equal(grouping.koboSyncError, null);
    assert.equal(savedStates.at(-1), 'ready');
  });

  it('retains the Collection ID and reports a retryable sync error after partial failure', async () => {
    const grouping = createGrouping();
    const savedStates: string[] = [];
    const api = {
      findBookOrbitCollectionIdByName: async () => undefined,
      saveBookOrbitCollection: async () => 'collection-42',
      getBookOrbitMatchedBookIds: async () => [1],
      getBookOrbitCollectionBookIds: async () => [],
      changeBookOrbitCollectionBooks: async () => {
        throw new Error('internal provider detail');
      },
    } as unknown as ReaderDeliveryApi;

    const result = await syncBookOrbitKoboGrouping(
      api,
      'token',
      grouping,
      async (value) => {
        savedStates.push(value.koboSyncStatus);
        return value;
      }
    );

    assert.match(result.warning ?? '', /could not sync/);
    assert.equal(grouping.remoteKoboCollectionId, 'collection-42');
    assert.equal(grouping.koboSyncStatus, 'error');
    assert.doesNotMatch(
      grouping.koboSyncError ?? '',
      /internal provider detail/
    );
    assert.equal(savedStates.at(-1), 'error');
  });
});
