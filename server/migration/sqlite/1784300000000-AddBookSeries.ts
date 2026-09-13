import { Table, type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddBookSeries1784300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'book_series',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'provider', type: 'varchar' },
          { name: 'providerId', type: 'varchar' },
          { name: 'title', type: 'varchar' },
          { name: 'authorId', type: 'integer' },
        ],
        uniques: [
          {
            name: 'UQ_book_series_provider',
            columnNames: ['provider', 'providerId'],
          },
        ],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('book_series');
  }
}
