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
import { prepareAppointmentBookingStep } from "./steps/prepare-appointment-booking"
import { reserveAppointmentStep } from "./steps/reserve-appointment"

export type AddToCartWithAppointmentWorkflowInput = {
  cart_id: string
  resource_id: string
  variant_id: string
  /** ISO start time of the chosen slot. */
  start: string
  buyer: {
    name: string
    email: string
    phone?: string | null
    notes?: string | null
  }
}

/**
 * Reserves a slot for the buyer and puts it in their cart.
 *
 *   lock (slot + cart) -> prepare (validate, server-side price)
 *   -> reserve (hold a place; DB constraints are the backstop)
 *   -> add the line to the cart (no shipping, quantity 1)
 *
 * The hold is taken BEFORE payment, so completing the cart can only confirm a
 * place that is already the buyer's - there is no "paid, but the slot filled"
 * outcome. If any step after the hold fails, the hold is released by the
 * workflow's compensation.
 *
 * The client chooses a resource, a variant and a start time. It never chooses a
 * price: the unit price (when a pricing rule applies) is computed by
 * prepareAppointmentBookingStep.
 */
// Annotated because TypeScript cannot name the inferred workflow type without
// reaching into pnpm's internal node_modules path (error TS2742).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const addToCartWithAppointmentWorkflow: any = createWorkflow(
  "add-to-cart-with-appointment",
  (input: AddToCartWithAppointmentWorkflowInput) => {
    // Two keys: the slot (two buyers racing for the same time) and the cart (two
    // adds from the same cart racing each other).
    const lockKeys = transform({ input }, (data) => [
      `appointment-slot:${data.input.resource_id}:${new Date(data.input.start).toISOString()}`,
      `cart:${data.input.cart_id}`,
    ])

    acquireLockStep({ key: lockKeys, timeout: 5, ttl: 30 })

    const prepared = prepareAppointmentBookingStep({
      cart_id: input.cart_id,
      resource_id: input.resource_id,
      variant_id: input.variant_id,
      start: input.start,
    })

    const reserveInput = transform({ input, prepared }, (data) => ({
      resource_id: data.input.resource_id,
      product_id: data.prepared.product_id,
      variant_id: data.input.variant_id,
      start: data.input.start,
      customer_id: data.prepared.customer_id,
      buyer: data.input.buyer,
    }))

    const reserved = reserveAppointmentStep(reserveInput)

    const items = transform({ input, prepared, reserved }, (data) => [
      {
        variant_id: data.input.variant_id,
        // One booking is one line; the quantity is never taken from the client.
        quantity: 1,
        // Appointments are not shipped. Set explicitly because Medusa's own
        // derivation falls back to "shippable" when a product has no shipping
        // profile, which makes cart completion demand a shipping method (see
        // add-tickets-to-cart.ts for the full explanation).
        requires_shipping: false,
        ...(data.prepared.unit_price !== null
          ? { unit_price: data.prepared.unit_price }
          : {}),
        metadata: {
          appointment_id: data.reserved.appointment_id,
          attendee_id: data.reserved.attendee_id,
          resource_id: data.input.resource_id,
          resource_name: data.prepared.resource_name,
          resource_timezone: data.prepared.resource_timezone,
          start_time: data.reserved.start_time,
          end_time: data.reserved.end_time,
          hold_expires_at: data.reserved.hold_expires_at,
          base_price: data.prepared.base_price,
          pricing_rule_id: data.prepared.applied_rule_id,
        },
      },
    ])

    addToCartWorkflow.runAsStep({
      input: {
        cart_id: input.cart_id,
        items: items as any,
      },
    })

    const { data: updatedCart } = useQueryGraphStep({
      entity: "cart",
      fields: ["*", "items.*"],
      filters: { id: input.cart_id },
    }).config({ name: "refetch-cart-after-appointment" })

    releaseLockStep({ key: lockKeys })

    return new WorkflowResponse({
      cart: updatedCart[0],
      hold: reserved,
    })
  }
)
