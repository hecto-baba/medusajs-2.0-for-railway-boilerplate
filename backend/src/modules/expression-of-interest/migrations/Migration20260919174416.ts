import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260919174416 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "eoi" ("id" text not null, "product_id" text not null, "variant_id" text not null, "customer_id" text null, "customer_email" text not null, "cart_id" text null, "order_id" text null, "line_item_id" text null, "value_type" text check ("value_type" in ('fixed', 'percentage')) not null, "value_amount" numeric not null, "quoted_unit_price" numeric not null, "eoi_charged_amount" numeric not null, "remaining_amount" numeric not null, "status" text check ("status" in ('pending', 'converted', 'cancelled')) not null default 'pending', "raw_value_amount" jsonb not null, "raw_quoted_unit_price" jsonb not null, "raw_eoi_charged_amount" jsonb not null, "raw_remaining_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "eoi_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_eoi_deleted_at" ON "eoi" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "eoi_configuration" ("id" text not null, "product_id" text not null, "value_type" text check ("value_type" in ('fixed', 'percentage')) not null default 'percentage', "value_amount" numeric not null, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "raw_value_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "eoi_configuration_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_eoi_configuration_deleted_at" ON "eoi_configuration" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "eoi" cascade;`);

    this.addSql(`drop table if exists "eoi_configuration" cascade;`);
  }

}
