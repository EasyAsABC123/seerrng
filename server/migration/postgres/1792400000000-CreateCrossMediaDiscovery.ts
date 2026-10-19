import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCrossMediaDiscovery1792400000000 implements MigrationInterface {
  name = 'CreateCrossMediaDiscovery1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('follow'))) {
      await queryRunner.query(
        `CREATE TABLE "follow" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "kind" character varying(32) NOT NULL, "subjectKey" character varying(255) NOT NULL, "subjectLabel" character varying(255) NOT NULL, "conditions" text, "notify" boolean NOT NULL DEFAULT true, "autoRequest" boolean NOT NULL DEFAULT false, "cursor" text, "lastCheckedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_follow_user_kind_subject" UNIQUE ("userId", "kind", "subjectKey"), CONSTRAINT "FK_follow_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE, CONSTRAINT "PK_follow" PRIMARY KEY ("id"))`
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_follow_kind" ON "follow" ("kind")`
      );
    }

    if (!(await queryRunner.hasTable('follow_event'))) {
      await queryRunner.query(
        `CREATE TABLE "follow_event" ("id" SERIAL NOT NULL, "followId" integer NOT NULL, "userId" integer NOT NULL, "dedupeKey" character varying(255) NOT NULL, "reasonKey" character varying(64) NOT NULL, "reasonValues" text, "title" character varying(255) NOT NULL, "imageUrl" character varying(1024), "target" text, "seen" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_follow_event_follow_dedupe" UNIQUE ("followId", "dedupeKey"), CONSTRAINT "FK_follow_event_follow" FOREIGN KEY ("followId") REFERENCES "follow" ("id") ON DELETE CASCADE, CONSTRAINT "FK_follow_event_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE, CONSTRAINT "PK_follow_event" PRIMARY KEY ("id"))`
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_follow_event_user_seen" ON "follow_event" ("userId", "seen")`
      );
    }

    if (!(await queryRunner.hasTable('media_relation'))) {
      await queryRunner.query(
        `CREATE TABLE "media_relation" ("id" SERIAL NOT NULL, "fromType" character varying(24) NOT NULL, "fromId" character varying(128) NOT NULL, "toType" character varying(24) NOT NULL, "toId" character varying(128) NOT NULL, "relation" character varying(24) NOT NULL, "confidence" character varying(12) NOT NULL DEFAULT 'low', "evidence" character varying(512), "source" character varying(32) NOT NULL, "verified" boolean NOT NULL DEFAULT false, "rejected" boolean NOT NULL DEFAULT false, "data" text, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_media_relation_edge" UNIQUE ("fromType", "fromId", "toType", "toId", "relation"), CONSTRAINT "PK_media_relation" PRIMARY KEY ("id"))`
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
        `CREATE TABLE "saved_discovery" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "name" character varying(120) NOT NULL, "mediaType" character varying(16) NOT NULL DEFAULT 'game', "filters" text NOT NULL, "exclusions" text, "notify" boolean NOT NULL DEFAULT true, "knownIds" text, "lastRunAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "FK_saved_discovery_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE, CONSTRAINT "PK_saved_discovery" PRIMARY KEY ("id"))`
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
        'ALTER TABLE "software_request" ADD "selectionKey" character varying(255)'
      );
    }

    for (const column of ['editionPolicy', 'variantKey']) {
      if (!(await queryRunner.hasColumn('media_request', column))) {
        await queryRunner.query(
          `ALTER TABLE "media_request" ADD "${column}" character varying`
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
