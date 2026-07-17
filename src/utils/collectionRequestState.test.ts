import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCoveredCollectionPartIds } from './collectionRequestState';

describe('collection request state', () => {
  it('tracks the movie identity instead of the active request identity', () => {
    assert.deepStrictEqual(
      getCoveredCollectionPartIds(
        [
          {
            id: 900,
            mediaInfo: {
              requests: [
                {
                  is4k: false,
                  status: MediaRequestStatus.PENDING,
                },
              ],
            },
          },
        ],
        false
      ),
      [900]
    );
  });

  it('partitions requests and availability by resolution', () => {
    assert.deepStrictEqual(
      getCoveredCollectionPartIds(
        [
          {
            id: 1,
            mediaInfo: {
              status: MediaStatus.AVAILABLE,
              status4k: MediaStatus.UNKNOWN,
            },
          },
          {
            id: 2,
            mediaInfo: {
              requests: [
                {
                  is4k: true,
                  status: MediaRequestStatus.PENDING,
                },
                {
                  is4k: false,
                  status: MediaRequestStatus.FAILED,
                },
              ],
            },
          },
        ],
        false
      ),
      [1]
    );
    assert.deepStrictEqual(
      getCoveredCollectionPartIds(
        [
          {
            id: 1,
            mediaInfo: {
              status: MediaStatus.AVAILABLE,
              status4k: MediaStatus.UNKNOWN,
            },
          },
          {
            id: 2,
            mediaInfo: {
              requests: [
                {
                  is4k: true,
                  status: MediaRequestStatus.PENDING,
                },
              ],
            },
          },
        ],
        true
      ),
      [2]
    );
  });
});
