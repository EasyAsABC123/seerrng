import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { AddBinderyRequestTracking1792500000000 } from './1792500000000-AddBinderyRequestTracking';

test('adds and removes the Bindery request reference column', async () => {
  const dataSource = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
  }).initialize();
  const queryRunner = dataSource.createQueryRunner();
  const migration = new AddBinderyRequestTracking1792500000000();

  try {
    await queryRunner.query(`
      CREATE TABLE "book_request_search" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "requestId" integer NOT NULL
      )
    `);
    await queryRunner.query(
      'INSERT INTO "book_request_search" ("requestId") VALUES (42)'
    );

    await migration.up(queryRunner);
    await migration.up(queryRunner);
    await queryRunner.query(
      'UPDATE "book_request_search" SET "binderyRequestId" = 91 WHERE "requestId" = 42'
    );
    assert.deepEqual(
      await queryRunner.query(
        'SELECT "requestId", "binderyRequestId" FROM "book_request_search"'
      ),
      [{ requestId: 42, binderyRequestId: 91 }]
    );

    await migration.down(queryRunner);
    await migration.down(queryRunner);
    const columns = await queryRunner.query(
      'PRAGMA table_info("book_request_search")'
    );
    assert.equal(
      columns.some(
        (column: { name: string }) => column.name === 'binderyRequestId'
      ),
      false
    );
    assert.deepEqual(
      await queryRunner.query('SELECT "requestId" FROM "book_request_search"'),
      [{ requestId: 42 }]
    );
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
});
