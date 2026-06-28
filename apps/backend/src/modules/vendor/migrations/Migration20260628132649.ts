import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260628132649 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "vendor" ("id" text not null, "name" text not null, "email" text not null, "phone" text null, "fulfillment_type" text check ("fulfillment_type" in ('dropship', 'via_terminal')) not null default 'dropship', "terminal_address" jsonb null, "email_language" text check ("email_language" in ('et', 'en')) not null default 'et', "notes" text null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vendor_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_deleted_at" ON "vendor" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vendor" cascade;`);
  }

}
