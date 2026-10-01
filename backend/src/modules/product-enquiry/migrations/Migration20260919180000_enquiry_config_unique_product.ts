import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Hardens the "one config per product" invariant at the database level.
 *
 * upsertEnquiryConfigWorkflow reads "does a config exist for this product"
 * and then creates one if not - two concurrent "Enable Enquiries" calls
 * (double-click, two admin tabs) can both pass that read before either
 * write lands, producing two enquiry_configuration rows for one product.
 * Nothing in application code was reliably preventing that; this index is
 * the actual fix; see docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md audit
 * findings.
 *
 * Partial (WHERE deleted_at IS NULL): a soft-deleted config must not block
 * a product from being re-enabled later, so uniqueness only applies among
 * live rows - mirrors the deleted_at partial index every model in this
 * codebase already has for its own primary lookups.
 *
 * Confirmed zero existing duplicate product_id rows before writing this
 * (checked directly against the live table) - safe to apply as-is, no
 * cleanup step needed.
 */
export class Migration20260919180000_enquiry_config_unique_product extends Migration {

  override async up(): Promise<void> {
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_enquiry_configuration_product_id_unique" ON "enquiry_configuration" ("product_id") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_enquiry_configuration_product_id_unique";`);
  }

}
