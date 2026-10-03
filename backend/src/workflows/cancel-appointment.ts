import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { cancelAppointmentStep, CancelAppointmentStepInput } from "./steps/cancel-appointment"

/**
 * Serialized per attendee: two clicks (or a buyer and a vendor cancelling at the
 * same moment) cannot both read "confirmed" and both proceed. The second one
 * waits for the lock, then sees "already cancelled" and gets a clean error.
 *
 * The key is built inside transform(): inside createWorkflow the input is a
 * placeholder, not a real object, so it can only be read in a transform callback.
 */
export const cancelAppointmentWorkflow = createWorkflow(
  "cancel-appointment",
  (input: CancelAppointmentStepInput) => {
    const lockKey = transform(
      { input },
      (data) => `appointment-attendee:${data.input.appointment_attendee_id}`
    )

    acquireLockStep({ key: lockKey, timeout: 5, ttl: 15 })

    const result = cancelAppointmentStep(input)

    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(result)
  }
)
