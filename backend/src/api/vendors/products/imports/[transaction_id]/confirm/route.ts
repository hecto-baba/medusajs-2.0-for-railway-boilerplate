import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { IWorkflowEngineService } from "@medusajs/framework/types"
import { Modules, TransactionHandlerType } from "@medusajs/framework/utils"
import {
  importProductsAsChunksWorkflowId,
  waitConfirmationProductImportStepId,
} from "@medusajs/medusa/core-flows"
import { assertVendorOwnsImport, markImportConfirmed } from "../../helpers"

/**
 * Confirms a pending product import, releasing the workflow's wait step.
 *
 * The import must be one the calling seller started: the transaction id alone
 * is not a credential, and without this check any seller could release another
 * seller's (or the admin's) pending import. Anyone else gets a 404.
 *
 * Once confirmed, the products the import creates are linked back to the seller
 * by handle: the background step has no request, so the link is written by the
 * product.created subscriber (subscribers/link-imported-products.ts).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { transaction_id } = req.params

  const record = await assertVendorOwnsImport(req, transaction_id)

  // Marked BEFORE the importer is released: it creates products in the background
  // and the subscriber that links them needs the import on record by then.
  await markImportConfirmed(req, record.id)

  const workflowEngineService: IWorkflowEngineService = req.scope.resolve(
    Modules.WORKFLOW_ENGINE
  )

  await workflowEngineService.setStepSuccess({
    idempotencyKey: {
      action: TransactionHandlerType.INVOKE,
      transactionId: transaction_id,
      stepId: waitConfirmationProductImportStepId,
      workflowId: importProductsAsChunksWorkflowId,
    },
    stepResponse: { output: true } as any,
  })

  res.status(202).json({})
}
