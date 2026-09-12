import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { exportTransactionTypesStep } from "../steps/transaction-type/export-transaction-types"

export type ExportTransactionTypesWorkflowInput = {
  /**
   * The same filters the list route accepts, so an admin exports exactly the
   * rows they are looking at rather than always the whole table.
   */
  filters?: Record<string, unknown>
}

export const exportTransactionTypesWorkflow = createWorkflow(
  "export-transaction-types",
  (input: ExportTransactionTypesWorkflowInput) => {
    const file = exportTransactionTypesStep({ filters: input.filters })

    return new WorkflowResponse(file)
  }
)
