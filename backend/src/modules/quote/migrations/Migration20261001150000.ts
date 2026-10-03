import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * The quote model has a `metadata` column but no migration ever created it: it
 * only exists on databases where src/scripts/add-quote-metadata.ts was run by
 * hand. On a fresh database every quote insert failed with
 * `column "metadata" of relation "quote" does not exist`. Idempotent, so it is a
 * no-op where the column is already there.
 */
export class Migration20261001150000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "quote" add column if not exists "metadata" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "quote" drop column if exists "metadata";`);
  }

}
