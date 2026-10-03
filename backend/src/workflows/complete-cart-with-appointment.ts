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
import { APPOINTMENT_BOOKING_MODULE } from "../modules/appointment-booking"
import { validateAppointmentAvailabilityStep } from "./steps/validate-appointment-availability"
import {
  createAppointmentAttendeesStep,
  CreateAppointmentAttendeesStepInput,
} from "./steps/create-appointment-attendees"

export type CompleteCartWithAppointmentWorkflowInput = {
  cart_id: string
}

/**
 * Mirrors complete-cart-with-tickets.ts: runs completeCartWorkflow as a step
 * rather than hooking it (the rental module already owns
 * completeCartWorkflow.hooks.validate), re-checks availability defensively
 * since time passed between add-to-cart and payment, then records who got
 * the slot.
 */
export const completeCartWithAppointmentWorkflow = createWorkflow(
  "complete-cart-with-appointment",
  (input: CompleteCartWithAppointmentWorkflowInput) => {
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
      fields: ["id", "customer_id", "items.id", "items.metadata"],
      filters: { id: input.cart_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "retrieve-cart-with-appointment-items" })

    const appointmentItems = transform({ carts }, (data) =>
      data.carts[0].items.filter((item) => item.metadata?.appointment_id)
    )

    when({ appointmentItems }, (data) => data.appointmentItems.length > 0).then(
      () => {
        const appointmentIds = transform({ appointmentItems }, (data) =>
          data.appointmentItems.map((item) => item.metadata!.appointment_id as string)
        )

        // Re-check capacity now that payment has actually happened - a slot
        // can fill between add-to-cart and completion the same way a ticket
        // seat can (see validate-ticket-order.ts). Compensation for this step
        // throwing is a no-op (nothing was written yet), so the order stays
        // completed but unbooked; the workflow error surfaces to the caller.
        validateAppointmentAvailabilityStep({
          appointment_ids: appointmentIds,
        })

        const attendees = createAppointmentAttendeesStep({
          order_id: order.id,
          customer_id: carts[0].customer_id,
          items: appointmentItems,
        } as unknown as CreateAppointmentAttendeesStepInput)

        const linkData = transform({ order, attendees }, (data) =>
          data.attendees.map((attendee: any) => ({
            [APPOINTMENT_BOOKING_MODULE]: {
              appointment_attendee_id: attendee.id,
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
        "items.*",
      ],
      filters: { id: order.id },
    }).config({ name: "refetch-completed-order" })

    return new WorkflowResponse({ order: orders[0] })
  }
)
