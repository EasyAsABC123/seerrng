import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBinderyRequestTracking1792500000000 implements MigrationInterface {
  name = 'AddBinderyRequestTracking1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasColumn('book_request_search', 'binderyRequestId'))
    ) {
      await queryRunner.query(
        'ALTER TABLE "book_request_search" ADD "binderyRequestId" integer'
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasColumn('book_request_search', 'binderyRequestId')
    ) {
      await queryRunner.query(
        'ALTER TABLE "book_request_search" DROP COLUMN "binderyRequestId"'
      );
    }
  }
}
