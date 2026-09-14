import type { CreatePromotionDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createPromotionsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorPromotionWorkflowInput = {
  vendor_admin_id: string
  promotion: CreatePromotionDTO
}

/**
 * Creates a promotion and links it to the vendor behind the calling admin.
 *
 * Mirrors create-vendor-product.ts: the link step is the whole point - a
 * promotion created without it exists and is visible in the Medusa admin, but
 * is invisible to its own vendor forever.
 */
export const createVendorPromotionWorkflow = createWorkflow(
  "create-vendor-promotion",
  (input: CreateVendorPromotionWorkflowInput) => {
    const promotionData = transform({ input }, (data) => ({
      promotionsData: [data.input.promotion],
    }))

    const createdPromotions = createPromotionsWorkflow.runAsStep({
      input: promotionData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    const linksToCreate = transform(
      { createdPromotions, vendorAdmins },
      (data) =>
        data.createdPromotions.map((promotion) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: data.vendorAdmins[0].vendor.id,
          },
          [Modules.PROMOTION]: {
            promotion_id: promotion.id,
          },
        }))
    )

    createRemoteLinkStep(linksToCreate)

    const { data: promotions } = useQueryGraphStep({
      entity: "promotion",
      fields: ["*", "application_method.*", "rules.*"],
      filters: { id: createdPromotions[0].id },
    }).config({ name: "retrieve-promotions" })

    return new WorkflowResponse({ promotion: promotions[0] })
  }
)
