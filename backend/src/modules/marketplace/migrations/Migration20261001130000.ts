import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Remembers which seller started each CSV product import, so confirming an
 * import can be refused for anyone else and imported products can be linked back
 * to the seller. Idempotent.
 */
export class Migration20261001130000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "vendor_product_import" ("id" text not null, "vendor_id" text not null, "transaction_id" text not null, "file_key" text not null, "handles" jsonb not null, "status" text not null default 'pending', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vendor_product_import_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_product_import_vendor_id" ON "vendor_product_import" ("vendor_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vendor_product_import_transaction_id_unique" ON "vendor_product_import" ("transaction_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_product_import_deleted_at" ON "vendor_product_import" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vendor_product_import" cascade;`);
  }

}
