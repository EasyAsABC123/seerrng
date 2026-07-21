import PlexAPI, { type PlexLibraryItem } from '@server/api/plexapi';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { runUserSecurityMutation } from '@server/lib/userSecurityMutation';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import {
  PLEX_SCAN_ITEM_CONCURRENCY,
  PLEX_SCAN_PAGE_SIZE,
  PlexScanner,
  getBoundedPlexScanTotal,
  getPlexGuidCacheKey,
  preparePlexLibraryPageItems,
} from '.';

setupTestDb();

afterEach(() => {
  mock.restoreAll();
});

describe('Plex library page bounds', () => {
  it('caps oversized upstream pages before item processing', () => {
    const items = Array.from({ length: PLEX_SCAN_PAGE_SIZE + 10 }, (_, id) => ({
      ratingKey: String(id + 1),
    }));

    assert.strictEqual(
      preparePlexLibraryPageItems(items).length,
      PLEX_SCAN_PAGE_SIZE
    );
    assert.deepStrictEqual(preparePlexLibraryPageItems(null), []);
    assert.strictEqual(PLEX_SCAN_ITEM_CONCURRENCY, 10);
  });

  it('caps provider-declared scan totals and advances malformed totals safely', () => {
    assert.strictEqual(
      getBoundedPlexScanTotal(Number.MAX_SAFE_INTEGER, 0, 50),
      100_000
    );
    assert.strictEqual(getBoundedPlexScanTotal(0, 50, 50), 150);
    assert.strictEqual(getBoundedPlexScanTotal(75, 50, 25), 75);
  });
});

describe('getPlexGuidCacheKey', () => {
  it('isolates server-local rating keys by Plex machine identity', () => {
    const first = getPlexGuidCacheKey(
      {
        machineId: 'machine-one',
        ip: 'plex.local',
        port: 32400,
        useSsl: false,
      },
      '123'
    );
    const second = getPlexGuidCacheKey(
      {
        machineId: 'machine-two',
        ip: 'plex.local',
        port: 32400,
        useSsl: false,
      },
      '123'
    );

    assert.notStrictEqual(first, second);
    assert.match(first, /^plexguid:[a-f0-9]{64}$/);
    assert.strictEqual(first.includes('machine-one'), false);
  });

  it('uses the configured endpoint when a legacy server has no machine id', () => {
    const plain = getPlexGuidCacheKey(
      { ip: 'plex.local', port: 32400, useSsl: false },
      '123'
    );
    const tls = getPlexGuidCacheKey(
      { ip: 'plex.local', port: 32400, useSsl: true },
      '123'
    );
    const otherRatingKey = getPlexGuidCacheKey(
      { ip: 'plex.local', port: 32400, useSsl: false },
      '124'
    );

    assert.notStrictEqual(plain, tls);
    assert.notStrictEqual(plain, otherRatingKey);
  });
});

describe('Plex scanner configuration authority', () => {
  it('does not persist catalog results after the Plex endpoint changes', async () => {
    const settings = getSettings();
    settings.main = {
      ...settings.main,
      mediaServerType: MediaServerType.PLEX,
    };
    settings.radarr = [];
    settings.sonarr = [];
    settings.plex = {
      ...settings.plex,
      ip: 'plex.local',
      port: 32400,
      useSsl: false,
      libraries: [
        { id: 'movies', name: 'Movies', enabled: true, type: 'movie' },
      ],
    };
    mock.method(PlexAPI.prototype, 'getLibraries', async () => []);
    mock.method(PlexAPI.prototype, 'getLibraryContents', async () => {
      settings.plex = { ...settings.plex, ip: 'rotated-plex.local' };
      const item = {
        ratingKey: '991',
        title: 'Stale Plex Movie',
        guid: 'tmdb://991',
        addedAt: 1,
        updatedAt: 1,
        type: 'movie',
        Media: [{ videoResolution: '1080' }],
      } as PlexLibraryItem;
      return { items: [item], totalSize: 1 };
    });

    await new PlexScanner().run();

    assert.strictEqual(
      await getRepository(Media).findOne({ where: { tmdbId: 991 } }),
      null
    );
  });

  it('does not persist catalog results after the owner token changes', async () => {
    const settings = getSettings();
    settings.main = {
      ...settings.main,
      mediaServerType: MediaServerType.PLEX,
    };
    settings.radarr = [];
    settings.sonarr = [];
    settings.plex = {
      ...settings.plex,
      ip: 'plex.local',
      port: 32400,
      useSsl: false,
      libraries: [
        { id: 'movies', name: 'Movies', enabled: true, type: 'movie' },
      ],
    };
    mock.method(PlexAPI.prototype, 'getLibraries', async () => []);
    mock.method(PlexAPI.prototype, 'getLibraryContents', async () => {
      await runUserSecurityMutation(1, () =>
        getRepository(User)
          .update(1, { plexToken: 'rotated-during-scan' })
          .then(() => undefined)
      );
      return {
        items: [
          {
            ratingKey: '993',
            title: 'Stale Owner Movie',
            guid: 'tmdb://993',
            addedAt: 1,
            updatedAt: 1,
            type: 'movie',
            Media: [{ videoResolution: '1080' }],
          } as PlexLibraryItem,
        ],
        totalSize: 1,
      };
    });

    await new PlexScanner().run();

    assert.strictEqual(
      await getRepository(Media).findOne({ where: { tmdbId: 993 } }),
      null
    );
  });
});
