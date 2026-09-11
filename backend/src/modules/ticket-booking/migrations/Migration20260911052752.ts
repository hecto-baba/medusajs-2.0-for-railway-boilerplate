import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260911052752 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ticket_product_venue_id_dates" ON "ticket_product" ("venue_id", "dates") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_ticket_product_venue_id_dates";`);
  }

}
