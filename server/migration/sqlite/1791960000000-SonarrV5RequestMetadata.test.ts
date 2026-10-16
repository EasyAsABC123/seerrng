import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { SonarrV5RequestMetadata1791960000000 } from './1791960000000-SonarrV5RequestMetadata';

test('adds Sonarr v5 request settings and order-scoped season mappings', async () => {
  const dataSource = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
  }).initialize();
  const queryRunner = dataSource.createQueryRunner();
  const migration = new SonarrV5RequestMetadata1791960000000();

  try {
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)`
    );
    await queryRunner.query(
      `CREATE TABLE "media_identifier" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)`
    );
    await queryRunner.query(
      `CREATE TABLE "media_identifier_season_mapping" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaIdentifierId" integer NOT NULL, "sonarrServerId" integer NOT NULL, "is4k" boolean NOT NULL DEFAULT (0), "seasonNumber" integer NOT NULL, "externalSeasonNumber" integer NOT NULL, CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "seasonNumber"), CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_EXTERNAL_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "externalSeasonNumber"), CONSTRAINT "FK_media_identifier_season_mapping_identifier" FOREIGN KEY ("mediaIdentifierId") REFERENCES "media_identifier" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_media_identifier_season_mapping_identifier" ON "media_identifier_season_mapping" ("mediaIdentifierId")`
    );
    await queryRunner.query(`INSERT INTO "media_identifier" ("id") VALUES (1)`);
    await queryRunner.query(
      `INSERT INTO "media_identifier_season_mapping" ("mediaIdentifierId", "sonarrServerId", "seasonNumber", "externalSeasonNumber") VALUES (1, 7, 1, 2)`
    );

    await migration.up(queryRunner);
    assert.equal(
      await queryRunner.hasColumn('media_request', 'metadataLanguageId'),
      true
    );
    assert.equal(
      await queryRunner.hasColumn('media_request', 'sonarrSeasonType'),
      true
    );
    assert.deepEqual(
      await queryRunner.query(
        `SELECT "seasonType", "seasonNumber", "externalSeasonNumber" FROM "media_identifier_season_mapping"`
      ),
      [{ seasonType: 'standard', seasonNumber: 1, externalSeasonNumber: 2 }]
    );

    await queryRunner.query(
      `INSERT INTO "media_identifier_season_mapping" ("mediaIdentifierId", "sonarrServerId", "seasonType", "seasonNumber", "externalSeasonNumber") VALUES (1, 7, 'absolute', 1, 1)`
    );
    await assert.rejects(
      queryRunner.query(
        `INSERT INTO "media_identifier_season_mapping" ("mediaIdentifierId", "sonarrServerId", "seasonType", "seasonNumber", "externalSeasonNumber") VALUES (1, 7, 'absolute', 1, 3)`
      )
    );

    await migration.down(queryRunner);
    assert.equal(
      await queryRunner.hasColumn('media_request', 'metadataLanguageId'),
      false
    );
    assert.equal(
      await queryRunner.hasColumn('media_request', 'sonarrSeasonType'),
      false
    );
    assert.deepEqual(
      await queryRunner.query(
        `SELECT "seasonNumber", "externalSeasonNumber" FROM "media_identifier_season_mapping"`
      ),
      [{ seasonNumber: 1, externalSeasonNumber: 2 }]
    );
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
});
