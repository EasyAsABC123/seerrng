import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { ExpandSwipeDiscovery1792200000000 } from './1792200000000-ExpandSwipeDiscovery';

test('expands swipe decisions without losing existing or expanded identities', async () => {
  const dataSource = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
  }).initialize();
  const queryRunner = dataSource.createQueryRunner();
  const migration = new ExpandSwipeDiscovery1792200000000();

  try {
    await queryRunner.query(`
      CREATE TABLE "swipe_decision" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "userId" integer NOT NULL,
        "mediaType" varchar(8) NOT NULL,
        "itemId" varchar(64) NOT NULL,
        "title" varchar(512) NOT NULL,
        "decision" varchar(8) NOT NULL,
        "tags" varchar(1024),
        "createdAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_swipe_decision_identity" ON "swipe_decision" ("userId", "mediaType", "itemId")'
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_swipe_decision_user_created" ON "swipe_decision" ("userId", "createdAt")'
    );
    await queryRunner.query(`
      INSERT INTO "swipe_decision" ("userId", "mediaType", "itemId", "title", "decision")
      VALUES (1, 'movie', '603', 'The Matrix', 'want')
    `);

    await migration.up(queryRunner);

    const columns = await queryRunner.query(
      'PRAGMA table_info("swipe_decision")'
    );
    assert.equal(
      columns.some((column: { name: string }) => column.name === 'cardData'),
      true
    );
    await queryRunner.query(`
      INSERT INTO "swipe_decision" ("userId", "mediaType", "itemId", "title", "decision", "cardData")
      VALUES (1, 'software-modern', '${'x'.repeat(180)}', 'Expanded title', 'pass', '{"title":"Expanded title"}')
    `);
    assert.deepEqual(
      await queryRunner.query(
        'SELECT "mediaType", "itemId", "title", "decision", "cardData" FROM "swipe_decision" ORDER BY "id"'
      ),
      [
        {
          mediaType: 'movie',
          itemId: '603',
          title: 'The Matrix',
          decision: 'want',
          cardData: null,
        },
        {
          mediaType: 'software-modern',
          itemId: 'x'.repeat(180),
          title: 'Expanded title',
          decision: 'pass',
          cardData: '{"title":"Expanded title"}',
        },
      ]
    );

    await migration.down(queryRunner);
    const rollbackColumns = await queryRunner.query(
      'PRAGMA table_info("swipe_decision")'
    );
    assert.equal(
      rollbackColumns.some(
        (column: { name: string }) => column.name === 'cardData'
      ),
      false
    );
    assert.deepEqual(
      await queryRunner.query(
        'SELECT "mediaType", "itemId", "title", "decision" FROM "swipe_decision" ORDER BY "id"'
      ),
      [
        {
          mediaType: 'movie',
          itemId: '603',
          title: 'The Matrix',
          decision: 'want',
        },
        {
          mediaType: 'software-modern',
          itemId: 'x'.repeat(180),
          title: 'Expanded title',
          decision: 'pass',
        },
      ]
    );
    await assert.rejects(
      queryRunner.query(`
        INSERT INTO "swipe_decision" ("userId", "mediaType", "itemId", "title", "decision")
        VALUES (1, 'movie', '603', 'Duplicate', 'pass')
      `)
    );
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
});
