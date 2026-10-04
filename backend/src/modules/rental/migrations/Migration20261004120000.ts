import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * How a rental reaches the renter, set per product by the seller:
 *  - "both":     the renter chooses pickup or delivery (the default, and what
 *                every existing product keeps),
 *  - "pickup":   collected from the seller only, no delivery address needed,
 *  - "delivery": delivered only.
 */
export class Migration20261004120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "rental_configuration" add column if not exists "fulfilment_modes" text check ("fulfilment_modes" in ('both', 'pickup', 'delivery')) not null default 'both';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "rental_configuration" drop column if exists "fulfilment_modes";`);
  }

}
