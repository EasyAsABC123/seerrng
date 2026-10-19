import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminManagedEpisodeQueueDefault1792620000000 implements MigrationInterface {
  name = 'AdminManagedEpisodeQueueDefault1792620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "media_request" SET "watchAheadEpisodeCount" = CASE WHEN "isAutoRequest" = false THEN COALESCE((SELECT "episodeQueueDefaultEpisodeCount" FROM "user_settings" WHERE "user_settings"."userId" = "media_request"."requestedById"), 0) ELSE 0 END, "watchAheadUsesUserDefault" = true, "watchAheadLastSeason" = NULL, "watchAheadLastEpisode" = NULL, "watchAheadLastReconciledAt" = NULL WHERE "type" = 'tv' AND "watchAheadParentRequestId" IS NULL`
    );
    await queryRunner.query(
      `UPDATE "user" SET "episodeQueueAccessStatus" = CASE WHEN COALESCE((SELECT "episodeQueueDefaultEpisodeCount" FROM "user_settings" WHERE "user_settings"."userId" = "user"."id"), 0) > 0 THEN 'approved' ELSE 'off' END, "episodeQueueAccessRequestedAt" = NULL`
    );
  }

  public async down(): Promise<void> {
    // The previous per-show values cannot be reconstructed after collapsing
    // them into a single per-user default.
  }
}
