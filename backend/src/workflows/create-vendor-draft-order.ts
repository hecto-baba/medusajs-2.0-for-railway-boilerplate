import type { CreateOrderDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createOrderWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules, OrderStatus } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorDraftOrderWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  order: CreateOrderDTO
}

export const createVendorDraftOrderWorkflow = createWorkflow(
  "create-vendor-draft-order",
  (input: CreateVendorDraftOrderWorkflowInput) => {
    const orderData = transform({ input }, (data) => ({
      ...data.input.order,
      status: OrderStatus.DRAFT,
      is_draft_order: true,
    }))

    const order = createOrderWorkflow.runAsStep({
      input: orderData as any,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    const linkToCreate = transform(
      { input, order, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link draft order: Authenticated vendor profile does not exist.")
        }
        return [
          {
            [MARKETPLACE_MODULE]: {
              vendor_id: vendorId,
            },
            [Modules.ORDER]: {
              order_id: data.order.id,
            },
          },
        ]
      }
    )

    createRemoteLinkStep(linkToCreate)

    const { data: draftOrders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "is_draft_order",
        "currency_code",
        "email",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "discount_total",
        "created_at",
        "customer.*",
        "shipping_address.*",
        "billing_address.*",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
        "shipping_methods.*",
      ],
      filters: { id: order.id },
    }).config({ name: "retrieve-created-draft-order" })

    return new WorkflowResponse({ draft_order: draftOrders[0] })
  }
)
