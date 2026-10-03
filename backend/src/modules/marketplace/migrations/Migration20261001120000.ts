import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * The Vendor model declares `metadata`, but no earlier migration created the
 * column, so a database built from migrations alone could not register a
 * vendor ("column metadata of relation vendor does not exist"). Databases that
 * already have the column are unaffected: both statements are idempotent.
 */
export class Migration20261001120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "vendor" add column if not exists "metadata" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "vendor" drop column if exists "metadata";`);
  }

}
