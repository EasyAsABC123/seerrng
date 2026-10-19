import assert from 'node:assert/strict';
import test from 'node:test';

import { DataSource } from 'typeorm';
import { CreateCrossMediaDiscovery1792400000000 } from './1792400000000-CreateCrossMediaDiscovery';

const columnNames = async (
  queryRunner: ReturnType<DataSource['createQueryRunner']>,
  table: string
) =>
  (
    (await queryRunner.query(`PRAGMA table_info("${table}")`)) as {
      name: string;
    }[]
  ).map((column) => column.name);

test('SQLite cross-media migration is idempotent and reversible', async () => {
  const dataSource = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
  }).initialize();
  const queryRunner = dataSource.createQueryRunner();
  const migration = new CreateCrossMediaDiscovery1792400000000();

  try {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY, "email" varchar NOT NULL)`
    );
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY)`
    );
    await queryRunner.query(
      `CREATE TABLE "software_request" ("id" integer PRIMARY KEY)`
    );

    await migration.up(queryRunner);
    // Running again must change nothing: startup can replay a migration.
    await migration.up(queryRunner);

    for (const table of [
      'follow',
      'follow_event',
      'media_relation',
      'saved_discovery',
    ]) {
      assert.ok((await columnNames(queryRunner, table)).length > 0, table);
    }
    assert.ok(
      (await columnNames(queryRunner, 'media_request')).includes(
        'editionPolicy'
      )
    );
    assert.ok(
      (await columnNames(queryRunner, 'software_request')).includes(
        'selectionKey'
      )
    );

    await queryRunner.query(`INSERT INTO "user" ("id","email") VALUES (1,'a')`);
    await queryRunner.query(
      `INSERT INTO "follow" ("userId","kind","subjectKey","subjectLabel") VALUES (1,'narrator','n:a','A')`
    );
    await assert.rejects(
      queryRunner.query(
        `INSERT INTO "follow" ("userId","kind","subjectKey","subjectLabel") VALUES (1,'narrator','n:a','A')`
      ),
      /UNIQUE/
    );

    await migration.down(queryRunner);
    assert.equal(
      (await columnNames(queryRunner, 'follow')).length,
      0,
      'follow table removed'
    );
    assert.ok(
      !(await columnNames(queryRunner, 'media_request')).includes(
        'editionPolicy'
      )
    );
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
});
