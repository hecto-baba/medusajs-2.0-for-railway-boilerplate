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

/**
 * Confirms a pending product import, releasing the workflow's wait step.
 *
 * KNOWN LIMITATION - products created by an import are not linked to the
 * vendor.
 *
 * The rows are written by an async background step that has no request
 * context, so there is no point at which this route can see the created ids and
 * write vendor links for them. The products are created and are visible in the
 * Medusa admin, but they will not appear in the vendor's own product list and
 * no ownership check will pass for them.
 *
 * Closing this properly needs a subscriber on product.created that reads the
 * import's transaction id and links the rows back to the vendor who started it.
 * Until that exists, import is safe (it cannot touch another vendor's products
 * - see the checks in ../route.ts) but incomplete, and a platform admin has to
 * assign imported products to their vendor.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const workflowEngineService: IWorkflowEngineService = req.scope.resolve(
    Modules.WORKFLOW_ENGINE
  )

  const { transaction_id } = req.params

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
