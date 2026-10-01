import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createRemoteLinkStep,
  createTaxRatesWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"
import { syncVendorTaxRulesStep } from "./steps/sync-vendor-tax-rules"

export type CreateVendorTaxRateWorkflowInput = {
  vendor_admin_id: string
  tax_rate: { tax_region_id: string; name: string; code?: string | null; rate: number }
}

/**
 * Creates a non-default tax rate in a platform tax region, links it to the
 * calling seller, then adds rules for every product and shipping option the
 * seller owns, so the rate applies to the seller's goods only (lib/vendor-tax.ts).
 */
export const createVendorTaxRateWorkflow = createWorkflow(
  "create-vendor-tax-rate",
  (input: CreateVendorTaxRateWorkflowInput) => {
    const createData = transform({ input }, (data) => [
      { ...data.input.tax_rate, is_default: false },
    ])

    const created = createTaxRatesWorkflow.runAsStep({ input: createData as any })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admin-for-tax-rate" })

    const vendorId = transform({ vendorAdmins }, (data) => {
      const id = data.vendorAdmins?.[0]?.vendor?.id
      if (!id) {
        throw new Error("Cannot link tax rate: authenticated vendor profile does not exist.")
      }
      return id as string
    })

    const links = transform({ created, vendorId }, (data) =>
      (data.created as any[]).map((rate) => ({
        [MARKETPLACE_MODULE]: { vendor_id: data.vendorId },
        [Modules.TAX]: { tax_rate_id: rate.id },
      }))
    )

    createRemoteLinkStep(links)

    syncVendorTaxRulesStep(transform({ vendorId }, (data) => ({ vendor_id: data.vendorId })))

    return new WorkflowResponse(
      transform({ created }, (data) => ({ tax_rate: (data.created as any[])[0] }))
    )
  }
)
