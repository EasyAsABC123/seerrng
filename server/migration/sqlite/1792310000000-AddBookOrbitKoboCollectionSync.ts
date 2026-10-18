import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookOrbitKoboCollectionSync1792310000000 implements MigrationInterface {
  name = 'AddBookOrbitKoboCollectionSync1792310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "reader_delivery_grouping" ADD "remoteKoboCollectionId" varchar(255)'
    );
    await queryRunner.query(
      `ALTER TABLE "reader_delivery_grouping" ADD "koboSyncStatus" varchar(16) NOT NULL DEFAULT 'disabled'`
    );
    await queryRunner.query(
      'ALTER TABLE "reader_delivery_grouping" ADD "koboSyncError" varchar(512)'
    );
    await queryRunner.query(
      'ALTER TABLE "reader_delivery_grouping" ADD "lastKoboSyncedAt" datetime'
    );
    await queryRunner.query(
      `UPDATE "reader_delivery_grouping" SET "koboSyncStatus" = 'pending' WHERE "provider" = 'bookorbit' AND "syncToKobo" = 1`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "reader_delivery_grouping" DROP COLUMN "lastKoboSyncedAt"'
    );
    await queryRunner.query(
      'ALTER TABLE "reader_delivery_grouping" DROP COLUMN "koboSyncError"'
    );
    await queryRunner.query(
      'ALTER TABLE "reader_delivery_grouping" DROP COLUMN "koboSyncStatus"'
    );
    await queryRunner.query(
      'ALTER TABLE "reader_delivery_grouping" DROP COLUMN "remoteKoboCollectionId"'
    );
  }
}
