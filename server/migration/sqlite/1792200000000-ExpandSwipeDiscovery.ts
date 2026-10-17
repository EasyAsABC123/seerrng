import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandSwipeDiscovery1792200000000 implements MigrationInterface {
  name = 'ExpandSwipeDiscovery1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SQLite does not enforce varchar lengths, so new media identifiers fit
    // without rebuilding the existing user-decision indexes.
    await queryRunner.query(
      'ALTER TABLE "swipe_decision" ADD COLUMN "cardData" text'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "swipe_decision" DROP COLUMN "cardData"'
    );
  }
}
