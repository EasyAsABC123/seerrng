import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdultIdentityUniqueness1791990000000 implements MigrationInterface {
  name = 'AddAdultIdentityUniqueness1791990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_media_identifier_canonical_adult" ON "media_identifier" ("provider", "value") WHERE "provider" = 'stashdb'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_media_identifier_canonical_adult"`
    );
  }
}
