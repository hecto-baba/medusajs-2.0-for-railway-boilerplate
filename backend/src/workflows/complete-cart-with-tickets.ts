import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  completeCartWorkflow,
  createRemoteLinkStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { TICKET_BOOKING_MODULE } from "../modules/ticket-booking"
import ticketPurchaseOrderLink from "../links/ticket-purchase-order"
import {
  validateTicketOrderStep,
  ValidateTicketOrderStepInput,
} from "./steps/validate-ticket-order"
import {
  createTicketPurchasesStep,
  CreateTicketPurchasesStepInput,
} from "./steps/create-ticket-purchases"

export type CompleteCartWithTicketsWorkflowInput = {
  cart_id: string
}

/**
 * Completes a cart containing tickets, then records the seats it sold.
 *
 * Wrapping completeCartWorkflow rather than hooking it matters here: the
 * rental module already owns completeCartWorkflow.hooks.validate, and a hook
 * accepts only one handler. Running the core workflow as a step keeps the
 * rental validation firing normally for mixed carts.
 *
 * The cart lock closes the window where two shoppers could complete carts
 * holding the same seat, and the `when` guard makes a retry idempotent: if
 * purchases were already linked to this order, they are not created twice.
 */
export const completeCartWithTicketsWorkflow = createWorkflow(
  "complete-cart-with-tickets",
  (input: CompleteCartWithTicketsWorkflowInput) => {
    acquireLockStep({
      key: input.cart_id,
      timeout: 2,
      ttl: 10,
    })

    const order = completeCartWorkflow.runAsStep({
      input: { id: input.cart_id },
    })

    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id",
        "items.id",
        "items.quantity",
        "items.metadata",
        "items.variant_id",
        "items.variant.id",
        "items.variant.product_id",
        "items.variant.options.value",
        "items.variant.options.option.title",
        "items.variant.ticket_product_variant.*",
        "items.variant.ticket_product_variant.purchases.*",
      ],
      filters: { id: input.cart_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "retrieve-cart-with-tickets" })

    const { data: existingLinks } = useQueryGraphStep({
      entity: ticketPurchaseOrderLink.entryPoint,
      fields: ["ticket_purchase_id"],
      filters: { order_id: order.id },
    }).config({ name: "retrieve-existing-ticket-links" })

    when({ existingLinks }, (data) => data.existingLinks.length === 0).then(
      () => {
        validateTicketOrderStep({
          items: carts[0].items,
          order_id: order.id,
        } as unknown as ValidateTicketOrderStepInput)

        const ticketPurchases = createTicketPurchasesStep({
          order_id: order.id,
          items: carts[0].items,
        } as unknown as CreateTicketPurchasesStepInput)

        const linkData = transform(
          { order, ticketPurchases },
          (data) =>
            data.ticketPurchases.map((purchase) => ({
              [TICKET_BOOKING_MODULE]: {
                ticket_purchase_id: purchase.id,
              },
              [Modules.ORDER]: {
                order_id: data.order.id,
              },
            }))
        )

        createRemoteLinkStep(linkData)
      }
    )

    releaseLockStep({
      key: input.cart_id,
    })

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "subtotal",
        "tax_total",
        "discount_total",
        "created_at",
        "customer.*",
        "billing_address.*",
        "items.*",
      ],
      filters: { id: order.id },
    }).config({ name: "refetch-completed-order" })

    return new WorkflowResponse({ order: orders[0] })
  }
)
