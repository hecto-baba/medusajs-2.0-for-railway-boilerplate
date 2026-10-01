import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { syncVendorTaxRules } from "../../lib/vendor-tax"

/**
 * Adds the seller's new product (or shipping option) to the rules of their tax
 * rates. Nothing to undo: the rules only ever add coverage, and a rule that
 * names a deleted product is inert.
 */
export const syncVendorTaxRulesStep = createStep(
  "sync-vendor-tax-rules",
  async (input: { vendor_id: string }, { container }) => {
    const added = await syncVendorTaxRules(container, input.vendor_id)
    return new StepResponse({ added })
  }
)
