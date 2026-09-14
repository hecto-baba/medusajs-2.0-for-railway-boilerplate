import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { IWorkflowEngineService } from "@medusajs/framework/types"
import { Modules, TransactionHandlerType } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  importTransactionTypesWorkflowId,
  waitConfirmationTransactionTypeImportStepId,
} from "../../../../../../workflows/transaction-type/import-transaction-types"

/**
 * Phase two: resumes the parked import so it writes.
 *
 * The run is identified by the transaction id handed back from the upload,
 * and resumed by marking the wait step successful. The workflow re-checks the
 * parsed rows after the pause, so a file with invalid rows still cannot be
 * committed by calling this directly.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const workflowEngineService: IWorkflowEngineService = req.scope.resolve(
    Modules.WORKFLOW_ENGINE
  )

  await workflowEngineService.setStepSuccess({
    idempotencyKey: {
      action: TransactionHandlerType.INVOKE,
      transactionId: req.params.transaction_id,
      stepId: waitConfirmationTransactionTypeImportStepId,
      workflowId: importTransactionTypesWorkflowId,
    },
    stepResponse: new StepResponse(true),
  })

  res.status(202).json({})
}
