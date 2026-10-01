import { model } from "@medusajs/framework/utils"

/**
 * Per-product Expression of Interest configuration. Mirrors RentalConfiguration's
 * fixed-vs-percentage shape (security_deposit_amount / security_deposit_type) —
 * see docs/plan/EXPRESSION_OF_INTEREST_MODULE_PLAN.md Phase 1.1.
 */
export const EoiConfiguration = model.define("eoi_configuration", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  value_type: model.enum(["fixed", "percentage"]).default("percentage"),
  // Flat currency amount when value_type = "fixed", or percentage points
  // (0-100) of the item's calculated unit price when value_type = "percentage".
  value_amount: model.bigNumber(),
  status: model.enum(["active", "inactive"]).default("active"),
})
