import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  addToCartWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"

export type AddTicketsToCartWorkflowInput = {
  cart_id: string
  items: {
    variant_id: string
    metadata: Record<string, unknown>
  }[]
}

/**
 * Adds ticket seats to a cart as line items that require no shipping.
 *
 * The explicit `requires_shipping: false` is the point of this workflow. Medusa
 * derives that flag in prepareLineItemData as
 *
 *   isDefined(item.requires_shipping)
 *     ? item.requires_shipping
 *     : hasShippingProfile || someInventoryRequiresShipping
 *
 * and only the first branch is dependable here. The ticket product carries no
 * shipping profile and its inventory items are created with requires_shipping
 * false, yet line items still came out shippable, because with nothing to
 * derive from the flag falls through to the line item model's own default of
 * true. Cart completion then refuses the cart: "No shipping method selected but
 * the cart contains items that require shipping."
 *
 * Setting the flag on the item sidesteps that whole derivation, so a ticket is
 * unshippable regardless of how the product's profile or inventory links are
 * configured later.
 *
 * Seats are added in one addToCartWorkflow call rather than one per seat, so
 * either the whole selection joins the cart or none of it does; a partial add
 * would leave the shopper holding some of the seats they picked.
 */
export const addTicketsToCartWorkflow = createWorkflow(
  "add-tickets-to-cart",
  (input: AddTicketsToCartWorkflowInput) => {
    // Guards the same window as the ticket completion workflow: two shoppers
    // adding the same seat should not both get past the seat checks that the
    // completion workflow runs under this lock.
    acquireLockStep({
      key: input.cart_id,
      timeout: 2,
      ttl: 10,
    })

    const itemsToAdd = transform({ input }, (data) =>
      data.input.items.map((item) => ({
        variant_id: item.variant_id,
        // One seat is one ticket. The completion workflow rejects any ticket
        // line with a different quantity, so it is fixed here rather than
        // taken from the request.
        quantity: 1,
        requires_shipping: false,
        metadata: item.metadata,
      }))
    )

    addToCartWorkflow.runAsStep({
      input: {
        cart_id: input.cart_id,
        items: itemsToAdd as any,
      },
    })

    const { data: updatedCart } = useQueryGraphStep({
      entity: "cart",
      fields: ["*", "items.*"],
      filters: { id: input.cart_id },
    }).config({ name: "refetch-cart" })

    releaseLockStep({
      key: input.cart_id,
    })

    return new WorkflowResponse({ cart: updatedCart[0] })
  }
)
