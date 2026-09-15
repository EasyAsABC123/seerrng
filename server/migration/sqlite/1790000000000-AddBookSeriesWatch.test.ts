import { AddBookSeriesWatch1790000000000 } from '@server/migration/sqlite/1790000000000-AddBookSeriesWatch';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { DataSource } from 'typeorm';
it('persists independent format watches and enforces one request per scoped provider identity', async () => {
  const source = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
  }).initialize();
  const runner = source.createQueryRunner();
  try {
    const migration = new AddBookSeriesWatch1790000000000();
    await migration.up(runner);
    const insert = (scope: string) =>
      runner.query(
        'INSERT INTO book_series_watch_request (scope, providerId, title, format, status, serverId, requestedById) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [scope, 'hc:988', 'Kingkiller', 'audiobook', 'pending', 0, 1]
      );
    await insert('backend:audiobook');
    await assert.rejects(() => insert('backend:audiobook'));
    await insert('backend:ebook');
    assert.equal(
      (await runner.query('SELECT * FROM book_series_watch_request')).length,
      2
    );
    await migration.down(runner);
    assert.equal(await runner.hasTable('book_series_watch_request'), false);
  } finally {
    await runner.release();
    await source.destroy();
  }
});
