import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { CreateReaderDeliveryGroupings1791030000000 } from './1791030000000-CreateReaderDeliveryGroupings';
import { AddBookOrbitKoboCollectionSync1792310000000 } from './1792310000000-AddBookOrbitKoboCollectionSync';

test('adds durable BookOrbit Kobo Collection state and queues legacy opt-ins', async () => {
  const dataSource = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
  }).initialize();
  const queryRunner = dataSource.createQueryRunner();
  const base = new CreateReaderDeliveryGroupings1791030000000();
  const migration = new AddBookOrbitKoboCollectionSync1792310000000();

  try {
    await base.up(queryRunner);
    await queryRunner.query(`
      INSERT INTO "reader_delivery_grouping"
        ("provider", "targetType", "targetId", "targetName", "groupName", "syncToKobo")
      VALUES
        ('bookorbit', 'book-series', 'series:1', 'One', 'Managed One', 1),
        ('bookorbit', 'book-series', 'series:2', 'Two', 'Managed Two', 0)
    `);

    await migration.up(queryRunner);
    const groupings = await queryRunner.query(
      'SELECT "remoteKoboCollectionId", "koboSyncStatus", "koboSyncError", "lastKoboSyncedAt" FROM "reader_delivery_grouping" ORDER BY "targetId"'
    );
    assert.deepEqual(groupings, [
      {
        remoteKoboCollectionId: null,
        koboSyncStatus: 'pending',
        koboSyncError: null,
        lastKoboSyncedAt: null,
      },
      {
        remoteKoboCollectionId: null,
        koboSyncStatus: 'disabled',
        koboSyncError: null,
        lastKoboSyncedAt: null,
      },
    ]);

    await migration.down(queryRunner);
    const columns = await queryRunner.query(
      'PRAGMA table_info("reader_delivery_grouping")'
    );
    assert.equal(
      columns.some(
        (column: { name: string }) => column.name === 'koboSyncStatus'
      ),
      false
    );
    await base.down(queryRunner);
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
});
