import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEpisodeQueueUserPreferences1792610000000 implements MigrationInterface {
  name = 'AddEpisodeQueueUserPreferences1792610000000';

  async up(runner: QueryRunner): Promise<void> {
    const shouldBackfillLegacyQueueAccess = !(await runner.hasColumn(
      'user',
      'episodeQueueAccessStatus'
    ));
    if (shouldBackfillLegacyQueueAccess) {
      await runner.query(
        `ALTER TABLE "user" ADD "episodeQueueAccessStatus" varchar(16) NOT NULL DEFAULT 'off'`
      );
    }
    if (!(await runner.hasColumn('user', 'episodeQueueAccessRequestedAt'))) {
      await runner.query(
        'ALTER TABLE "user" ADD "episodeQueueAccessRequestedAt" datetime'
      );
    }
    if (
      !(await runner.hasColumn(
        'user_settings',
        'episodeQueueDefaultEpisodeCount'
      ))
    ) {
      await runner.query(
        'ALTER TABLE "user_settings" ADD "episodeQueueDefaultEpisodeCount" integer NOT NULL DEFAULT 0'
      );
    }
    if (
      !(await runner.hasColumn('media_request', 'watchAheadUsesUserDefault'))
    ) {
      await runner.query(
        'ALTER TABLE "media_request" ADD "watchAheadUsesUserDefault" boolean NOT NULL DEFAULT true'
      );
      await runner.query(
        'UPDATE "media_request" SET "watchAheadUsesUserDefault" = CASE WHEN "watchAheadEpisodeCount" > 0 THEN false ELSE true END'
      );
    }
    if (shouldBackfillLegacyQueueAccess) {
      await runner.query(
        `UPDATE "user" SET "episodeQueueAccessStatus" = 'approved' WHERE EXISTS (SELECT 1 FROM "media_request" WHERE "media_request"."requestedById" = "user"."id" AND "media_request"."type" = 'tv' AND "media_request"."watchAheadEpisodeCount" > 0 AND "media_request"."watchAheadParentRequestId" IS NULL)`
      );
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasColumn('media_request', 'watchAheadUsesUserDefault')) {
      await runner.query(
        'ALTER TABLE "media_request" DROP COLUMN "watchAheadUsesUserDefault"'
      );
    }
    if (
      await runner.hasColumn('user_settings', 'episodeQueueDefaultEpisodeCount')
    ) {
      await runner.query(
        'ALTER TABLE "user_settings" DROP COLUMN "episodeQueueDefaultEpisodeCount"'
      );
    }
    if (await runner.hasColumn('user', 'episodeQueueAccessRequestedAt')) {
      await runner.query(
        'ALTER TABLE "user" DROP COLUMN "episodeQueueAccessRequestedAt"'
      );
    }
    if (await runner.hasColumn('user', 'episodeQueueAccessStatus')) {
      await runner.query(
        'ALTER TABLE "user" DROP COLUMN "episodeQueueAccessStatus"'
      );
    }
  }
}
