import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateEnquiryStatusStep } from "./steps/update-enquiry-status"

type UpdateEnquiryStatusWorkflowInput = {
  enquiry_id: string
  status: "pending" | "closed"
}

export const updateEnquiryStatusWorkflow = createWorkflow(
  "update-enquiry-status",
  ({ enquiry_id, status }: UpdateEnquiryStatusWorkflowInput) => {
    const enquiry = updateEnquiryStatusStep({ enquiry_id, status })

    return new WorkflowResponse(enquiry)
  }
)
