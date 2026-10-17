import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandSwipeDiscovery1792200000000 implements MigrationInterface {
  name = 'ExpandSwipeDiscovery1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "swipe_decision" ALTER COLUMN "mediaType" TYPE character varying(24)'
    );
    await queryRunner.query(
      'ALTER TABLE "swipe_decision" ALTER COLUMN "itemId" TYPE character varying(512)'
    );
    await queryRunner.query(
      'ALTER TABLE "swipe_decision" ADD COLUMN "cardData" text'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep widened identity columns so a rollback cannot truncate decisions
    // that were already made in the expanded media categories.
    await queryRunner.query(
      'ALTER TABLE "swipe_decision" DROP COLUMN "cardData"'
    );
  }
}
