import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Attributes each file a seller uploads to that seller. Idempotent.
 */
export class Migration20261001170000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "vendor_upload" ("id" text not null, "vendor_id" text not null, "file_id" text not null, "url" text not null, "filename" text null, "mime_type" text null, "size" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vendor_upload_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_upload_vendor_id" ON "vendor_upload" ("vendor_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vendor_upload_file_id_unique" ON "vendor_upload" ("file_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_upload_deleted_at" ON "vendor_upload" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vendor_upload" cascade;`);
  }

}
