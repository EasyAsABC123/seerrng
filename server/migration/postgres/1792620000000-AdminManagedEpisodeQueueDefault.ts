import { AdminManagedEpisodeQueueDefault1792620000000 as SqliteMigration } from '@server/migration/sqlite/1792620000000-AdminManagedEpisodeQueueDefault';
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminManagedEpisodeQueueDefault1792620000000 implements MigrationInterface {
  name = 'AdminManagedEpisodeQueueDefault1792620000000';

  private readonly sqliteMigration = new SqliteMigration();

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.sqliteMigration.up(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.sqliteMigration.down(queryRunner);
  }
}
