import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserMaturityRatingLimits1791970000000 implements MigrationInterface {
  name = 'AddUserMaturityRatingLimits1791970000000';

  async up(runner: QueryRunner): Promise<void> {
    if (
      !(await runner.hasColumn('user_settings', 'movieMaturityRatingLimit'))
    ) {
      await runner.query(
        'ALTER TABLE "user_settings" ADD COLUMN "movieMaturityRatingLimit" varchar'
      );
    }
    if (!(await runner.hasColumn('user_settings', 'tvMaturityRatingLimit'))) {
      await runner.query(
        'ALTER TABLE "user_settings" ADD COLUMN "tvMaturityRatingLimit" varchar'
      );
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasColumn('user_settings', 'tvMaturityRatingLimit')) {
      await runner.query(
        'ALTER TABLE "user_settings" DROP COLUMN "tvMaturityRatingLimit"'
      );
    }
    if (await runner.hasColumn('user_settings', 'movieMaturityRatingLimit')) {
      await runner.query(
        'ALTER TABLE "user_settings" DROP COLUMN "movieMaturityRatingLimit"'
      );
    }
  }
}
