import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import {
  rescheduleAppointmentStep,
  RescheduleAppointmentStepInput,
} from "./steps/reschedule-appointment"

export type RescheduleAppointmentWorkflowInput = RescheduleAppointmentStepInput & {
  /** false = do not email the buyer (the seller turned the box off). */
  notify?: boolean
}

/**
 * Serialized per attendee, like cancel: a reschedule racing a cancel (or another
 * reschedule) of the same booking waits, then sees the booking's new state and
 * fails with a clean message instead of acting on stale data.
 *
 * Emits `appointment.rescheduled` once the move has stuck; the subscriber sends
 * the buyer their new time.
 */
export const rescheduleAppointmentWorkflow = createWorkflow(
  "reschedule-appointment",
  (input: RescheduleAppointmentWorkflowInput) => {
    const lockKey = transform(
      { input },
      (data) => `appointment-attendee:${data.input.appointment_attendee_id}`
    )

    acquireLockStep({ key: lockKey, timeout: 5, ttl: 30 })

    const result = rescheduleAppointmentStep(input)

    releaseLockStep({ key: lockKey })

    emitEventStep({
      eventName: "appointment.rescheduled",
      data: transform({ input }, (data) => ({
        attendee_id: data.input.appointment_attendee_id,
        notify: data.input.notify !== false,
      })),
    })

    return new WorkflowResponse(result)
  }
)
