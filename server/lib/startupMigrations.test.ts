import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DataSource, type MigrationInterface, type QueryRunner } from 'typeorm';
import { runStartupMigrations } from './startupMigrations';

let migrationRuns = 0;

class ConcurrentStartupMigration1900000000000 implements MigrationInterface {
  name = 'ConcurrentStartupMigration1900000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    migrationRuns += 1;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    await queryRunner.query(
      `CREATE TABLE "startup_migration_result" (
        "id" integer PRIMARY KEY NOT NULL
      )`
    );
    await queryRunner.query(
      `INSERT INTO "startup_migration_result" ("id") VALUES (1)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "startup_migration_result"`);
  }
}

class FailingStartupMigration1900000000001 implements MigrationInterface {
  name = 'FailingStartupMigration1900000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rolled_back_migration" ("id" integer PRIMARY KEY)`
    );
    throw new Error('migration failed');
  }

  public async down(): Promise<void> {}
}

test('runStartupMigrations serializes competing SQLite processes', async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'seerr-startup-migrations-')
  );
  const database = path.join(directory, 'database.sqlite3');
  const createSource = () =>
    new DataSource({
      type: 'sqlite',
      database,
      migrations: [ConcurrentStartupMigration1900000000000],
    });
  const first = createSource();
  const second = createSource();
  migrationRuns = 0;

  try {
    await Promise.all([first.initialize(), second.initialize()]);
    const [firstResult, secondResult] = await Promise.all([
      runStartupMigrations(first),
      runStartupMigrations(second),
    ]);

    assert.strictEqual(migrationRuns, 1);
    assert.deepStrictEqual(
      [firstResult.length, secondResult.length].sort((a, b) => a - b),
      [0, 1]
    );
    assert.deepStrictEqual(
      await first.query(`SELECT "id" FROM "startup_migration_result"`),
      [{ id: 1 }]
    );
    assert.strictEqual(
      (await first.query('PRAGMA foreign_keys'))[0].foreign_keys,
      1
    );
  } finally {
    if (first.isInitialized) await first.destroy();
    if (second.isInitialized) await second.destroy();
    await fs.rm(directory, { force: true, recursive: true });
  }
});

test('runStartupMigrations rolls back failures and restores SQLite pragmas', async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'seerr-failed-migration-')
  );
  const source = new DataSource({
    type: 'sqlite',
    database: path.join(directory, 'database.sqlite3'),
    migrations: [FailingStartupMigration1900000000001],
  });

  try {
    await source.initialize();
    await assert.rejects(runStartupMigrations(source), /migration failed/);
    const queryRunner = source.createQueryRunner();
    assert.strictEqual(
      await queryRunner.hasTable('rolled_back_migration'),
      false
    );
    assert.strictEqual(await queryRunner.hasTable('migrations'), false);
    await queryRunner.release();
    assert.strictEqual(
      (await source.query('PRAGMA foreign_keys'))[0].foreign_keys,
      1
    );
  } finally {
    if (source.isInitialized) await source.destroy();
    await fs.rm(directory, { force: true, recursive: true });
  }
});
