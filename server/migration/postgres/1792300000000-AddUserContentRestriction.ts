import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserContentRestriction1792300000000 implements MigrationInterface {
  name = 'AddUserContentRestriction1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('user', 'contentRestricted'))) {
      await queryRunner.query(
        'ALTER TABLE "user" ADD "contentRestricted" boolean'
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('user', 'contentRestricted')) {
      await queryRunner.query(
        'ALTER TABLE "user" DROP COLUMN "contentRestricted"'
      );
    }
  }
}
