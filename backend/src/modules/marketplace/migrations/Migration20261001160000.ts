import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Tracks refunds against a seller's order in the payout ledger. Idempotent.
 */
export class Migration20261001160000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "vendor_order_split" add column if not exists "refunded_total" real not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "vendor_order_split" drop column if exists "refunded_total";`);
  }

}
