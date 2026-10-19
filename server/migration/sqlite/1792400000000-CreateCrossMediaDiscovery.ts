import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCrossMediaDiscovery1792400000000 implements MigrationInterface {
  name = 'CreateCrossMediaDiscovery1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('follow'))) {
      await queryRunner.query(
        `CREATE TABLE "follow" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer NOT NULL, "kind" varchar(32) NOT NULL, "subjectKey" varchar(255) NOT NULL, "subjectLabel" varchar(255) NOT NULL, "conditions" text, "notify" boolean NOT NULL DEFAULT (1), "autoRequest" boolean NOT NULL DEFAULT (0), "cursor" text, "lastCheckedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_follow_user_kind_subject" UNIQUE ("userId", "kind", "subjectKey"), CONSTRAINT "FK_follow_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE)`
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_follow_kind" ON "follow" ("kind")`
      );
    }

    if (!(await queryRunner.hasTable('follow_event'))) {
      await queryRunner.query(
        `CREATE TABLE "follow_event" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "followId" integer NOT NULL, "userId" integer NOT NULL, "dedupeKey" varchar(255) NOT NULL, "reasonKey" varchar(64) NOT NULL, "reasonValues" text, "title" varchar(255) NOT NULL, "imageUrl" varchar(1024), "target" text, "seen" boolean NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_follow_event_follow_dedupe" UNIQUE ("followId", "dedupeKey"), CONSTRAINT "FK_follow_event_follow" FOREIGN KEY ("followId") REFERENCES "follow" ("id") ON DELETE CASCADE, CONSTRAINT "FK_follow_event_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE)`
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_follow_event_user_seen" ON "follow_event" ("userId", "seen")`
      );
    }

    if (!(await queryRunner.hasTable('media_relation'))) {
      await queryRunner.query(
        `CREATE TABLE "media_relation" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "fromType" varchar(24) NOT NULL, "fromId" varchar(128) NOT NULL, "toType" varchar(24) NOT NULL, "toId" varchar(128) NOT NULL, "relation" varchar(24) NOT NULL, "confidence" varchar(12) NOT NULL DEFAULT 'low', "evidence" varchar(512), "source" varchar(32) NOT NULL, "verified" boolean NOT NULL DEFAULT (0), "rejected" boolean NOT NULL DEFAULT (0), "data" text, "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_media_relation_edge" UNIQUE ("fromType", "fromId", "toType", "toId", "relation"))`
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_media_relation_from" ON "media_relation" ("fromType", "fromId")`
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_media_relation_to" ON "media_relation" ("toType", "toId")`
      );
    }

    if (!(await queryRunner.hasTable('saved_discovery'))) {
      await queryRunner.query(
        `CREATE TABLE "saved_discovery" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer NOT NULL, "name" varchar(120) NOT NULL, "mediaType" varchar(16) NOT NULL DEFAULT 'game', "filters" text NOT NULL, "exclusions" text, "notify" boolean NOT NULL DEFAULT (1), "knownIds" text, "lastRunAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "FK_saved_discovery_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE)`
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_saved_discovery_user" ON "saved_discovery" ("userId")`
      );
    }

    if (
      (await queryRunner.hasTable('software_request')) &&
      !(await queryRunner.hasColumn('software_request', 'selection'))
    ) {
      await queryRunner.query(
        'ALTER TABLE "software_request" ADD "selection" text'
      );
      await queryRunner.query(
        'ALTER TABLE "software_request" ADD "selectionKey" varchar(255)'
      );
    }

    for (const column of ['editionPolicy', 'variantKey']) {
      if (!(await queryRunner.hasColumn('media_request', column))) {
        await queryRunner.query(
          `ALTER TABLE "media_request" ADD "${column}" varchar`
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['selectionKey', 'selection']) {
      if (await queryRunner.hasColumn('software_request', column)) {
        await queryRunner.query(
          `ALTER TABLE "software_request" DROP COLUMN "${column}"`
        );
      }
    }
    for (const column of ['variantKey', 'editionPolicy']) {
      if (await queryRunner.hasColumn('media_request', column)) {
        await queryRunner.query(
          `ALTER TABLE "media_request" DROP COLUMN "${column}"`
        );
      }
    }
    await queryRunner.query('DROP TABLE IF EXISTS "saved_discovery"');
    await queryRunner.query('DROP TABLE IF EXISTS "media_relation"');
    await queryRunner.query('DROP TABLE IF EXISTS "follow_event"');
    await queryRunner.query('DROP TABLE IF EXISTS "follow"');
  }
}
