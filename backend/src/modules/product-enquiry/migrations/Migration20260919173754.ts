import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260919173754 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "enquiry_configuration" ("id" text not null, "product_id" text not null, "status" text check ("status" in ('active', 'inactive')) not null default 'inactive', "custom_fields" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "enquiry_configuration_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_enquiry_configuration_deleted_at" ON "enquiry_configuration" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "enquiry" add column if not exists "custom_field_answers" jsonb null, add column if not exists "custom_fields_snapshot" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "enquiry_configuration" cascade;`);

    this.addSql(`alter table if exists "enquiry" drop column if exists "custom_field_answers", drop column if exists "custom_fields_snapshot";`);
  }

}
