import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { EOI_MODULE } from "../../modules/expression-of-interest"
import ExpressionOfInterestModuleService from "../../modules/expression-of-interest/service"
import { OrderDTO } from "@medusajs/framework/types"

export type CreateEoiForOrderInput = {
  order: OrderDTO
}

/**
 * Mirrors create-rentals-for-order.ts: filters order.items for the
 * is_eoi metadata flag stamped by add-to-cart-with-eoi, and persists one Eoi
 * row per matching line item, reading the snapshotted metadata rather than
 * re-deriving from current config - so the record reflects exactly what was
 * quoted and charged at add-to-cart time, not whatever the product's EOI
 * configuration says by the time checkout completes.
 */
export const createEoiForOrderStep = createStep(
  "create-eoi-for-order",
  async ({ order }: CreateEoiForOrderInput, { container }) => {
    const eoiModuleService: ExpressionOfInterestModuleService =
      container.resolve(EOI_MODULE)

    const eoiItems = (order.items || []).filter((item) => {
      return item.metadata?.is_eoi === true
    })

    if (eoiItems.length === 0) {
      return new StepResponse([])
    }

    const eois = await eoiModuleService.createEois(
      eoiItems.map((item) => {
        const { variant_id, metadata } = item

        return {
          product_id: (item as any).product_id ?? (item as any).variant?.product_id,
          variant_id: variant_id!,
          customer_id: order.customer_id ?? null,
          customer_email: order.email!,
          cart_id: null,
          order_id: order.id,
          line_item_id: item.id,
          value_type: metadata?.eoi_value_type as "fixed" | "percentage",
          value_amount: metadata?.eoi_value_amount as number,
          quoted_unit_price: metadata?.eoi_quoted_unit_price as number,
          eoi_charged_amount: metadata?.eoi_charged_amount as number,
          remaining_amount: metadata?.eoi_remaining_amount as number,
          status: "converted" as const,
        }
      })
    )

    return new StepResponse(
      eois,
      eois.map((eoi) => eoi.id)
    )
  },
  async (eoiIds, { container }) => {
    if (!eoiIds) return

    const eoiModuleService: ExpressionOfInterestModuleService =
      container.resolve(EOI_MODULE)

    // Delete all created EOI rows on rollback
    await eoiModuleService.deleteEois(eoiIds)
  }
)
