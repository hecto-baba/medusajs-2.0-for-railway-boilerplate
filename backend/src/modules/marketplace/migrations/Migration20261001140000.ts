import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Seller orders split from multi-seller orders and the seller payout ledger.
 * Idempotent.
 */
export class Migration20261001140000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "vendor_order_split" ("id" text not null, "parent_order_id" text not null, "child_order_id" text not null, "vendor_id" text not null, "currency_code" text not null, "items_total" real not null, "shipping_total" real not null, "tax_total" real not null, "total" real not null, "payout_status" text not null default 'owed', "paid_at" timestamptz null, "payout_reference" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vendor_order_split_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_order_split_parent_order_id" ON "vendor_order_split" ("parent_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vendor_order_split_child_order_id_unique" ON "vendor_order_split" ("child_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_order_split_vendor_id" ON "vendor_order_split" ("vendor_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vendor_order_split_parent_order_id_vendor_id_unique" ON "vendor_order_split" ("parent_order_id", "vendor_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_order_split_deleted_at" ON "vendor_order_split" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vendor_order_split" cascade;`);
  }

}
