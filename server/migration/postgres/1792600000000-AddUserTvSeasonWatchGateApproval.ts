import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTvSeasonWatchGateApproval1792600000000 implements MigrationInterface {
  name = 'AddUserTvSeasonWatchGateApproval1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('user', 'tvSeasonWatchGateStatus'))) {
      await queryRunner.query(
        `ALTER TABLE "user" ADD "tvSeasonWatchGateStatus" character varying(16) NOT NULL DEFAULT 'off'`
      );
    }
    if (
      !(await queryRunner.hasColumn('user', 'tvSeasonWatchGateRequestedAt'))
    ) {
      await queryRunner.query(
        'ALTER TABLE "user" ADD "tvSeasonWatchGateRequestedAt" TIMESTAMP'
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('user', 'tvSeasonWatchGateRequestedAt')) {
      await queryRunner.query(
        'ALTER TABLE "user" DROP COLUMN "tvSeasonWatchGateRequestedAt"'
      );
    }
    if (await queryRunner.hasColumn('user', 'tvSeasonWatchGateStatus')) {
      await queryRunner.query(
        'ALTER TABLE "user" DROP COLUMN "tvSeasonWatchGateStatus"'
      );
    }
  }
}
