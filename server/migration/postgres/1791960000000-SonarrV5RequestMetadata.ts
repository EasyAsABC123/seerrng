import {
  TableColumn,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';

export class SonarrV5RequestMetadata1791960000000 implements MigrationInterface {
  name = 'SonarrV5RequestMetadata1791960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('media_request')) {
      if (
        !(await queryRunner.hasColumn('media_request', 'metadataLanguageId'))
      ) {
        await queryRunner.addColumn(
          'media_request',
          new TableColumn({
            name: 'metadataLanguageId',
            type: 'integer',
            isNullable: true,
          })
        );
      }
      if (!(await queryRunner.hasColumn('media_request', 'sonarrSeasonType'))) {
        await queryRunner.addColumn(
          'media_request',
          new TableColumn({
            name: 'sonarrSeasonType',
            type: 'varchar',
            isNullable: true,
          })
        );
      }
    }

    if (!(await queryRunner.hasTable('media_identifier_season_mapping'))) {
      return;
    }
    if (
      !(await queryRunner.hasColumn(
        'media_identifier_season_mapping',
        'seasonType'
      ))
    ) {
      await queryRunner.addColumn(
        'media_identifier_season_mapping',
        new TableColumn({
          name: 'seasonType',
          type: 'varchar',
          default: "'standard'",
          isNullable: false,
        })
      );
      await queryRunner.query(
        `ALTER TABLE "media_identifier_season_mapping" DROP CONSTRAINT IF EXISTS "UNIQUE_MEDIA_IDENTIFIER_SEASON_MAPPING"`
      );
      await queryRunner.query(
        `ALTER TABLE "media_identifier_season_mapping" DROP CONSTRAINT IF EXISTS "UNIQUE_MEDIA_IDENTIFIER_EXTERNAL_SEASON_MAPPING"`
      );
      await queryRunner.query(
        `ALTER TABLE "media_identifier_season_mapping" ADD CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "seasonType", "seasonNumber")`
      );
      await queryRunner.query(
        `ALTER TABLE "media_identifier_season_mapping" ADD CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_EXTERNAL_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "seasonType", "externalSeasonNumber")`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('media_identifier_season_mapping')) {
      await queryRunner.query(
        `DELETE FROM "media_identifier_season_mapping" WHERE "seasonType" <> 'standard'`
      );
      await queryRunner.query(
        `ALTER TABLE "media_identifier_season_mapping" DROP CONSTRAINT IF EXISTS "UNIQUE_MEDIA_IDENTIFIER_SEASON_MAPPING"`
      );
      await queryRunner.query(
        `ALTER TABLE "media_identifier_season_mapping" DROP CONSTRAINT IF EXISTS "UNIQUE_MEDIA_IDENTIFIER_EXTERNAL_SEASON_MAPPING"`
      );
      if (
        await queryRunner.hasColumn(
          'media_identifier_season_mapping',
          'seasonType'
        )
      ) {
        await queryRunner.dropColumn(
          'media_identifier_season_mapping',
          'seasonType'
        );
      }
      await queryRunner.query(
        `ALTER TABLE "media_identifier_season_mapping" ADD CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "seasonNumber")`
      );
      await queryRunner.query(
        `ALTER TABLE "media_identifier_season_mapping" ADD CONSTRAINT "UNIQUE_MEDIA_IDENTIFIER_EXTERNAL_SEASON_MAPPING" UNIQUE ("mediaIdentifierId", "sonarrServerId", "is4k", "externalSeasonNumber")`
      );
    }

    if (await queryRunner.hasTable('media_request')) {
      for (const column of ['sonarrSeasonType', 'metadataLanguageId']) {
        if (await queryRunner.hasColumn('media_request', column)) {
          await queryRunner.dropColumn('media_request', column);
        }
      }
    }
  }
}
