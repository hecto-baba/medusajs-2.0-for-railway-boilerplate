import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { respondToEnquiryStep } from "./steps/respond-to-enquiry"

type RespondToEnquiryWorkflowInput = {
  enquiry_id: string
  reply: string
}

/**
 * Emits "enquiry.responded" after a successful reply so the customer can be
 * notified (see src/subscribers/enquiry-responded.ts). Emitting from the
 * workflow rather than the route keeps the notification reachable from
 * anywhere this workflow runs later (e.g. a future vendor-facing route),
 * matching how order.placed/order.canceled decouple side effects from their
 * triggering route today. emitEventStep only fires after the workflow
 * completes successfully, so a failed save never triggers a notification.
 */
export const respondToEnquiryWorkflow = createWorkflow(
  "respond-to-enquiry",
  ({ enquiry_id, reply }: RespondToEnquiryWorkflowInput) => {
    const enquiry = respondToEnquiryStep({ enquiry_id, reply })

    emitEventStep({
      eventName: "enquiry.responded",
      data: { id: enquiry_id },
    })

    return new WorkflowResponse(enquiry)
  }
)
