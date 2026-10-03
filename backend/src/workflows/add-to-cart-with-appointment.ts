import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  addToCartWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { validateAppointmentAvailabilityStep } from "./steps/validate-appointment-availability"

type AddToCartWithAppointmentWorkflowInput = {
  cart_id: string
  appointment_id: string
  variant_id: string
  unit_price?: number
}

export const addToCartWithAppointmentWorkflow = createWorkflow(
  "add-to-cart-with-appointment",
  (input: AddToCartWithAppointmentWorkflowInput) => {
    acquireLockStep({
      key: input.appointment_id,
      timeout: 2,
      ttl: 10,
    })

    validateAppointmentAvailabilityStep({
      appointment_ids: [input.appointment_id],
    })

    const { data: appointments } = useQueryGraphStep({
      entity: "appointment",
      fields: ["id", "start_time", "end_time", "provider_id"],
      filters: { id: input.appointment_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "retrieve-appointment" })

    addToCartWorkflow.runAsStep({
      input: {
        cart_id: input.cart_id,
        items: [
          {
            variant_id: input.variant_id,
            quantity: 1,
            unit_price: input.unit_price,
            metadata: {
              appointment_id: input.appointment_id,
            },
          },
        ],
      },
    })

    const { data: updatedCart } = useQueryGraphStep({
      entity: "cart",
      fields: ["*", "items.*"],
      filters: { id: input.cart_id },
    }).config({ name: "refetch-cart" })

    releaseLockStep({
      key: input.appointment_id,
    })

    return new WorkflowResponse({
      cart: updatedCart[0],
      appointment: appointments[0],
    })
  }
)
