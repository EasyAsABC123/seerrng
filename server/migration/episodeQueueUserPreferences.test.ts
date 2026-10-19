import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { AddEpisodeQueueUserPreferences1792610000000 as PostgresMigration } from './postgres/1792610000000-AddEpisodeQueueUserPreferences';
import { AddEpisodeQueueUserPreferences1792610000000 as SqliteMigration } from './sqlite/1792610000000-AddEpisodeQueueUserPreferences';

describe('episode queue user preference migration', () => {
  it('preserves existing per-show queues and grants access to their owners', async () => {
    const source = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
    }).initialize();
    const runner = source.createQueryRunner();

    try {
      await runner.query('CREATE TABLE "user" ("id" integer PRIMARY KEY)');
      await runner.query(
        'CREATE TABLE "user_settings" ("id" integer PRIMARY KEY)'
      );
      await runner.query(
        'CREATE TABLE "media_request" ("id" integer PRIMARY KEY, "requestedById" integer, "type" varchar, "watchAheadEpisodeCount" integer, "watchAheadParentRequestId" integer)'
      );
      await runner.query('INSERT INTO "user" ("id") VALUES (1), (2)');
      await runner.query(
        `INSERT INTO "media_request" ("id", "requestedById", "type", "watchAheadEpisodeCount", "watchAheadParentRequestId") VALUES (1, 1, 'tv', 2, NULL), (2, 1, 'tv', 0, NULL), (3, 2, 'tv', 3, 1), (4, 2, 'movie', 4, NULL)`
      );

      const migration = new SqliteMigration();
      await migration.up(runner);
      await migration.up(runner);

      const users = await runner.query(
        'SELECT "id", "episodeQueueAccessStatus" FROM "user" ORDER BY "id"'
      );
      expect(users).toEqual([
        { id: 1, episodeQueueAccessStatus: 'approved' },
        { id: 2, episodeQueueAccessStatus: 'off' },
      ]);
      const requests = await runner.query(
        'SELECT "id", "watchAheadUsesUserDefault" FROM "media_request" ORDER BY "id"'
      );
      expect(requests).toEqual([
        { id: 1, watchAheadUsesUserDefault: 0 },
        { id: 2, watchAheadUsesUserDefault: 1 },
        { id: 3, watchAheadUsesUserDefault: 0 },
        { id: 4, watchAheadUsesUserDefault: 0 },
      ]);

      await runner.query(
        `UPDATE "user" SET "episodeQueueAccessStatus" = 'off' WHERE "id" = 1`
      );
      await migration.up(runner);
      expect(
        await runner.query(
          'SELECT "episodeQueueAccessStatus" FROM "user" WHERE "id" = 1'
        )
      ).toEqual([{ episodeQueueAccessStatus: 'off' }]);

      await migration.down(runner);
      expect(
        await runner.hasColumn('media_request', 'watchAheadUsesUserDefault')
      ).toBe(false);
      expect(
        await runner.hasColumn(
          'user_settings',
          'episodeQueueDefaultEpisodeCount'
        )
      ).toBe(false);
      expect(new PostgresMigration().name).toBe(migration.name);
    } finally {
      await runner.release();
      await source.destroy();
    }
  });
});
