import type { MigrationInterface, QueryRunner } from 'typeorm';

const createMappingTable = (queryRunner: QueryRunner, legacy: boolean) =>
  queryRunner.query(
    legacy
      ? `CREATE TABLE "media_identifier_season_mapping" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaIdentifierId" integer NOT NULL, "sonarrServerId" integer NOT NULL, "is4k" boolean NOT NULL DEFAULT (0), "seasonNumber" integer NOT NULL, "externalSeasonNumber" integer NOT NULL, CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "seasonNumber"), CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_EXTERNAL_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "externalSeasonNumber"), CONSTRAINT "FK_media_identifier_season_mapping_identifier" FOREIGN KEY ("mediaIdentifierId") REFERENCES "media_identifier" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
      : `CREATE TABLE "media_identifier_season_mapping" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaIdentifierId" integer NOT NULL, "sonarrServerId" integer NOT NULL, "is4k" boolean NOT NULL DEFAULT (0), "seasonType" varchar NOT NULL DEFAULT ('standard'), "seasonNumber" integer NOT NULL, "externalSeasonNumber" integer NOT NULL, CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "seasonType", "seasonNumber"), CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_EXTERNAL_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "seasonType", "externalSeasonNumber"), CONSTRAINT "FK_media_identifier_season_mapping_identifier" FOREIGN KEY ("mediaIdentifierId") REFERENCES "media_identifier" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
  );

export class SonarrV5RequestMetadata1791960000000 implements MigrationInterface {
  name = 'SonarrV5RequestMetadata1791960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('media_request')) {
      if (
        !(await queryRunner.hasColumn('media_request', 'metadataLanguageId'))
      ) {
        await queryRunner.query(
          'ALTER TABLE "media_request" ADD COLUMN "metadataLanguageId" integer'
        );
      }
      if (!(await queryRunner.hasColumn('media_request', 'sonarrSeasonType'))) {
        await queryRunner.query(
          'ALTER TABLE "media_request" ADD COLUMN "sonarrSeasonType" varchar'
        );
      }
    }

    if (
      !(await queryRunner.hasTable('media_identifier_season_mapping')) ||
      (await queryRunner.hasColumn(
        'media_identifier_season_mapping',
        'seasonType'
      ))
    ) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "media_identifier_season_mapping" RENAME TO "media_identifier_season_mapping_old"`
    );
    await createMappingTable(queryRunner, false);
    await queryRunner.query(
      `INSERT INTO "media_identifier_season_mapping" ("id", "mediaIdentifierId", "sonarrServerId", "is4k", "seasonType", "seasonNumber", "externalSeasonNumber") SELECT "id", "mediaIdentifierId", "sonarrServerId", "is4k", 'standard', "seasonNumber", "externalSeasonNumber" FROM "media_identifier_season_mapping_old"`
    );
    await queryRunner.query(`DROP TABLE "media_identifier_season_mapping_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_media_identifier_season_mapping_identifier" ON "media_identifier_season_mapping" ("mediaIdentifierId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('media_identifier_season_mapping')) {
      await queryRunner.query(
        `ALTER TABLE "media_identifier_season_mapping" RENAME TO "media_identifier_season_mapping_v5"`
      );
      await createMappingTable(queryRunner, true);
      await queryRunner.query(
        `INSERT INTO "media_identifier_season_mapping" ("id", "mediaIdentifierId", "sonarrServerId", "is4k", "seasonNumber", "externalSeasonNumber") SELECT "id", "mediaIdentifierId", "sonarrServerId", "is4k", "seasonNumber", "externalSeasonNumber" FROM "media_identifier_season_mapping_v5" WHERE "seasonType" = 'standard'`
      );
      await queryRunner.query(
        `DROP TABLE "media_identifier_season_mapping_v5"`
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_media_identifier_season_mapping_identifier" ON "media_identifier_season_mapping" ("mediaIdentifierId")`
      );
    }

    if (await queryRunner.hasTable('media_request')) {
      for (const column of ['sonarrSeasonType', 'metadataLanguageId']) {
        if (await queryRunner.hasColumn('media_request', column)) {
          await queryRunner.query(
            `ALTER TABLE "media_request" DROP COLUMN "${column}"`
          );
        }
      }
    }
  }
}
