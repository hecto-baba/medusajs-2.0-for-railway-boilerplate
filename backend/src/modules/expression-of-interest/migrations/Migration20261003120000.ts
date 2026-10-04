import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261003120000 extends Migration {

  override async up(): Promise<void> {
    // Fix #3 of docs/plan/EOI_VARIANT_LEVEL_FIX_EXECUTION_PLAN.md: without
    // this, two concurrent upserts for the same variant can both see "no
    // config exists" and both insert a row. Partial (WHERE deleted_at IS
    // NULL) so a soft-deleted config doesn't block creating a fresh one for
    // the same variant, matching this table's existing soft-delete index.
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_eoi_configuration_variant_id_unique" ON "eoi_configuration" ("variant_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_eoi_configuration_variant_id_unique";`);
  }

}
