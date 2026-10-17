import assert from 'node:assert/strict';
import test from 'node:test';
import type { QueryRunner } from 'typeorm';
import { ExpandSwipeDiscovery1792200000000 } from './1792200000000-ExpandSwipeDiscovery';

test('widens PostgreSQL swipe identities and retains them on rollback', async () => {
  const statements: string[] = [];
  const queryRunner = {
    query: async (statement: string) => {
      statements.push(statement);
    },
  } as QueryRunner;
  const migration = new ExpandSwipeDiscovery1792200000000();

  await migration.up(queryRunner);
  await migration.down(queryRunner);

  assert.deepEqual(statements, [
    'ALTER TABLE "swipe_decision" ALTER COLUMN "mediaType" TYPE character varying(24)',
    'ALTER TABLE "swipe_decision" ALTER COLUMN "itemId" TYPE character varying(512)',
    'ALTER TABLE "swipe_decision" ADD COLUMN "cardData" text',
    'ALTER TABLE "swipe_decision" DROP COLUMN "cardData"',
  ]);
});
