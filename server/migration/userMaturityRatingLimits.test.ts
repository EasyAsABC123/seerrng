import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { AddUserMaturityRatingLimits1791970000000 as PostgresMigration } from './postgres/1791970000000-AddUserMaturityRatingLimits';
import { AddUserMaturityRatingLimits1791970000000 as SqliteMigration } from './sqlite/1791970000000-AddUserMaturityRatingLimits';

test('user maturity rating limits migrate portably and preserve unrelated settings', async () => {
  for (const Migration of [SqliteMigration, PostgresMigration]) {
    const source = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
    }).initialize();
    const runner = source.createQueryRunner();

    try {
      await runner.query(
        'CREATE TABLE "user_settings" ("id" integer PRIMARY KEY, "locale" varchar)'
      );
      await runner.query(
        'INSERT INTO "user_settings" ("id", "locale") VALUES (1, \'en\')'
      );

      const migration = new Migration();
      await migration.up(runner);
      await runner.query(
        'UPDATE "user_settings" SET "movieMaturityRatingLimit" = \'PG\', "tvMaturityRatingLimit" = \'TV-14\' WHERE "id" = 1'
      );
      await migration.up(runner);

      assert.deepEqual(
        await runner.query(
          'SELECT "locale", "movieMaturityRatingLimit", "tvMaturityRatingLimit" FROM "user_settings" WHERE "id" = 1'
        ),
        [
          {
            locale: 'en',
            movieMaturityRatingLimit: 'PG',
            tvMaturityRatingLimit: 'TV-14',
          },
        ]
      );

      await migration.down(runner);
      assert.equal(
        await runner.hasColumn('user_settings', 'movieMaturityRatingLimit'),
        false
      );
      assert.equal(
        await runner.hasColumn('user_settings', 'tvMaturityRatingLimit'),
        false
      );
      assert.deepEqual(
        await runner.query(
          'SELECT "locale" FROM "user_settings" WHERE "id" = 1'
        ),
        [{ locale: 'en' }]
      );
    } finally {
      await runner.release();
      await source.destroy();
    }
  }
});
