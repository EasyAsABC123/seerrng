import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdultQuota1791980000000 implements MigrationInterface {
  name = 'AddAdultQuota1791980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('user', 'adultQuotaLimit'))) {
      await queryRunner.query(
        'ALTER TABLE "user" ADD "adultQuotaLimit" integer'
      );
    }
    if (!(await queryRunner.hasColumn('user', 'adultQuotaDays'))) {
      await queryRunner.query(
        'ALTER TABLE "user" ADD "adultQuotaDays" integer'
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('user', 'adultQuotaDays')) {
      await queryRunner.query(
        'ALTER TABLE "user" DROP COLUMN "adultQuotaDays"'
      );
    }
    if (await queryRunner.hasColumn('user', 'adultQuotaLimit')) {
      await queryRunner.query(
        'ALTER TABLE "user" DROP COLUMN "adultQuotaLimit"'
      );
    }
  }
}
