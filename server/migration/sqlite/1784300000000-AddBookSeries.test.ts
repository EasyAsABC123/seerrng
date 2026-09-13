import { AddBookSeries1784300000000 } from '@server/migration/sqlite/1784300000000-AddBookSeries';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { DataSource } from 'typeorm';

it('creates unique provider series identities and rolls back cleanly', async () => {
  const source = await new DataSource({
    type: 'sqlite',
    database: ':memory:',
  }).initialize();
  const runner = source.createQueryRunner();
  try {
    const migration = new AddBookSeries1784300000000();
    await migration.up(runner);
    const insert = () =>
      runner.query(
        'INSERT INTO book_series (provider, providerId, title, authorId) VALUES (?, ?, ?, ?)',
        ['readarr:1:endpoint:ebook', '10', 'Series', 2]
      );
    await insert();
    await assert.rejects(insert);
    assert.equal((await runner.query('SELECT id FROM book_series'))[0].id, 1);
    await migration.down(runner);
    assert.equal(await runner.hasTable('book_series'), false);
  } finally {
    await runner.release();
    await source.destroy();
  }
});
