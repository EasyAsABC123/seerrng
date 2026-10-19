import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { AdminManagedEpisodeQueueDefault1792620000000 as PostgresMigration } from './postgres/1792620000000-AdminManagedEpisodeQueueDefault';
import { AdminManagedEpisodeQueueDefault1792620000000 as SqliteMigration } from './sqlite/1792620000000-AdminManagedEpisodeQueueDefault';

describe('admin-managed Episode Queue default migration', () => {
  it('applies defaults only to manual root TV requests and clears review state', async () => {
    const source = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
    }).initialize();
    const runner = source.createQueryRunner();

    try {
      await runner.query(
        'CREATE TABLE "user" ("id" integer PRIMARY KEY, "episodeQueueAccessStatus" varchar(16) NOT NULL, "episodeQueueAccessRequestedAt" datetime)'
      );
      await runner.query(
        'CREATE TABLE "user_settings" ("id" integer PRIMARY KEY, "userId" integer, "episodeQueueDefaultEpisodeCount" integer NOT NULL DEFAULT 0)'
      );
      await runner.query(
        'CREATE TABLE "media_request" ("id" integer PRIMARY KEY, "requestedById" integer, "type" varchar, "watchAheadEpisodeCount" integer, "watchAheadUsesUserDefault" boolean, "watchAheadParentRequestId" integer, "watchAheadLastSeason" integer, "watchAheadLastEpisode" integer, "watchAheadLastReconciledAt" integer, "isAutoRequest" boolean)'
      );
      await runner.query(
        `INSERT INTO "user" VALUES (1, 'pending', '2026-10-18'), (2, 'approved', NULL), (3, 'off', NULL)`
      );
      await runner.query(
        `INSERT INTO "user_settings" VALUES (1, 1, 3), (2, 2, 0)`
      );
      await runner.query(
        `INSERT INTO "media_request" VALUES (1, 1, 'tv', 1, false, NULL, 2, 3, 4, false), (2, 1, 'tv', 0, true, NULL, NULL, NULL, NULL, false), (3, 2, 'tv', 2, false, NULL, 1, 2, 3, false), (4, 1, 'tv', 2, false, 1, 1, 1, 1, false), (5, 1, 'movie', 2, false, NULL, NULL, NULL, NULL, false), (6, 1, 'tv', 4, false, NULL, 1, 2, 3, true)`
      );

      const migration = new SqliteMigration();
      await migration.up(runner);
      await migration.up(runner);

      expect(
        await runner.query(
          'SELECT "id", "watchAheadEpisodeCount", "watchAheadUsesUserDefault", "watchAheadLastSeason", "watchAheadLastEpisode", "watchAheadLastReconciledAt", "isAutoRequest" FROM "media_request" ORDER BY "id"'
        )
      ).toEqual([
        {
          id: 1,
          watchAheadEpisodeCount: 3,
          watchAheadUsesUserDefault: 1,
          watchAheadLastSeason: null,
          watchAheadLastEpisode: null,
          watchAheadLastReconciledAt: null,
          isAutoRequest: 0,
        },
        {
          id: 2,
          watchAheadEpisodeCount: 3,
          watchAheadUsesUserDefault: 1,
          watchAheadLastSeason: null,
          watchAheadLastEpisode: null,
          watchAheadLastReconciledAt: null,
          isAutoRequest: 0,
        },
        {
          id: 3,
          watchAheadEpisodeCount: 0,
          watchAheadUsesUserDefault: 1,
          watchAheadLastSeason: null,
          watchAheadLastEpisode: null,
          watchAheadLastReconciledAt: null,
          isAutoRequest: 0,
        },
        {
          id: 4,
          watchAheadEpisodeCount: 2,
          watchAheadUsesUserDefault: 0,
          watchAheadLastSeason: 1,
          watchAheadLastEpisode: 1,
          watchAheadLastReconciledAt: 1,
          isAutoRequest: 0,
        },
        {
          id: 5,
          watchAheadEpisodeCount: 2,
          watchAheadUsesUserDefault: 0,
          watchAheadLastSeason: null,
          watchAheadLastEpisode: null,
          watchAheadLastReconciledAt: null,
          isAutoRequest: 0,
        },
        {
          id: 6,
          watchAheadEpisodeCount: 0,
          watchAheadUsesUserDefault: 1,
          watchAheadLastSeason: null,
          watchAheadLastEpisode: null,
          watchAheadLastReconciledAt: null,
          isAutoRequest: 1,
        },
      ]);
      expect(
        await runner.query(
          'SELECT "id", "episodeQueueAccessStatus", "episodeQueueAccessRequestedAt" FROM "user" ORDER BY "id"'
        )
      ).toEqual([
        {
          id: 1,
          episodeQueueAccessStatus: 'approved',
          episodeQueueAccessRequestedAt: null,
        },
        {
          id: 2,
          episodeQueueAccessStatus: 'off',
          episodeQueueAccessRequestedAt: null,
        },
        {
          id: 3,
          episodeQueueAccessStatus: 'off',
          episodeQueueAccessRequestedAt: null,
        },
      ]);

      await migration.down(runner);
      expect(new PostgresMigration().name).toBe(migration.name);
    } finally {
      await runner.release();
      await source.destroy();
    }
  });
});
