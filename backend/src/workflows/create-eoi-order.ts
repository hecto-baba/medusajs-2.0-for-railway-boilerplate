import {
  createWorkflow,
  WorkflowResponse,
  transform,
  when
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  completeCartWorkflow,
  releaseLockStep,
  useQueryGraphStep
} from "@medusajs/medusa/core-flows"
import {
  CreateEoiForOrderInput,
  createEoiForOrderStep
} from "./steps/create-eoi-for-order"

type CreateEoiOrderWorkflowInput = {
  cart_id: string
}

/**
 * Mirrors create-rentals.ts: locks the cart, completes it via core Medusa's
 * completeCartWorkflow, then - only if the resulting order actually has
 * EOI-flagged line items and no Eoi rows exist for it yet - persists the
 * Eoi rows off the completed order's line-item metadata.
 */
export const createEoiOrderWorkflow = createWorkflow(
  "create-eoi-order",
  ({ cart_id }: CreateEoiOrderWorkflowInput) => {
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: ["id", "items.id", "items.metadata"],
      filters: { id: cart_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "retrieve-cart-eoi" })

    const hasEoiItems = transform({ carts }, ({ carts }) => {
      return (carts[0].items || []).some((item) => item?.metadata?.is_eoi === true)
    })

    acquireLockStep({
      key: cart_id,
      timeout: 2,
      ttl: 10,
    })

    const order = completeCartWorkflow.runAsStep({
      input: { id: cart_id },
    })

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "email",
        "customer_id",
        "items.id",
        "items.variant_id",
        "items.product_id",
        "items.quantity",
        "items.metadata",
      ],
      filters: { id: order.id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "retrieve-order-eoi" })

    const { data: eois } = useQueryGraphStep({
      entity: "eoi",
      fields: ["id"],
      filters: { order_id: order.id },
    }).config({ name: "retrieve-eois" })

    when(
      { eois, hasEoiItems },
      (data) => data.eois.length === 0 && data.hasEoiItems
    ).then(() => {
      createEoiForOrderStep({
        order: orders[0],
      } as unknown as CreateEoiForOrderInput)
    })

    releaseLockStep({
      key: cart_id,
    })

    return new WorkflowResponse({
      order: orders[0],
    })
  }
)
