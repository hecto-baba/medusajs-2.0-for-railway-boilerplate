import { model } from "@medusajs/framework/utils"

/**
 * Per-variant Expression of Interest configuration. Mirrors RentalConfiguration's
 * fixed-vs-percentage shape (security_deposit_amount / security_deposit_type) —
 * see docs/plan/EXPRESSION_OF_INTEREST_MODULE_PLAN.md Phase 1.1.
 *
 * Scoped to variant, not product (see docs/plan/EOI_VARIANT_LEVEL_CONFIG_PLAN.md):
 * a "fixed" value must be able to differ between a product's variants, the same
 * way ticket-booking scopes TicketProductVariant to ProductVariant rather than
 * sharing one config across a product's whole variant set.
 */
export const EoiConfiguration = model.define("eoi_configuration", {
  id: model.id().primaryKey(),
  variant_id: model.text(),
  value_type: model.enum(["fixed", "percentage"]).default("percentage"),
  // Flat currency amount when value_type = "fixed", or percentage points
  // (0-100) of the item's calculated unit price when value_type = "percentage".
  value_amount: model.bigNumber(),
  status: model.enum(["active", "inactive"]).default("active"),
})
