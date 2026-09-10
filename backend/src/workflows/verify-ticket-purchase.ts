import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { verifyTicketPurchaseStep } from "./steps/verify-ticket-purchase"
import { updateTicketPurchaseStatusStep } from "./steps/update-ticket-purchase-status"

export type VerifyTicketPurchaseWorkflowInput = {
  ticket_purchase_id: string
}

/**
 * Scans a ticket at the door: rejects an already-scanned or expired ticket,
 * then marks it scanned so it cannot be reused.
 */
export const verifyTicketPurchaseWorkflow = createWorkflow(
  "verify-ticket-purchase",
  (input: VerifyTicketPurchaseWorkflowInput) => {
    verifyTicketPurchaseStep(input)

    const ticketPurchase = updateTicketPurchaseStatusStep({
      ticket_purchase_id: input.ticket_purchase_id,
      status: "scanned",
    })

    return new WorkflowResponse(ticketPurchase)
  }
)
