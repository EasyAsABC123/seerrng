import { Table, type MigrationInterface, type QueryRunner } from 'typeorm';
export class AddBookSeriesWatch1790000000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.createTable(
      new Table({
        name: 'book_series_watch_request',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          ...['scope', 'providerId', 'title', 'format', 'status'].map(
            (name) => ({ name, type: 'varchar' })
          ),
          ...['serverId', 'requestedById'].map((name) => ({
            name,
            type: 'integer',
          })),
          ...['approvedById', 'backendWatchId'].map((name) => ({
            name,
            type: 'integer',
            isNullable: true,
          })),
          { name: 'includeExtras', type: 'boolean', default: false },
        ],
        uniques: [
          {
            name: 'UQ_book_series_watch_target',
            columnNames: ['scope', 'providerId'],
          },
        ],
      })
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.dropTable('book_series_watch_request');
  }
}
