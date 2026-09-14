import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { exportProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Exports the vendor's products to CSV, delivered by email when the workflow
 * finishes (the admin behaves the same way).
 *
 * The filter is built here rather than taken from the request: the admin route
 * passes req.filterableFields straight through, which for a vendor would export
 * the entire store's catalogue. Restricting to the vendor's own product ids is
 * what makes this route safe to expose.
 *
 * An empty catalogue is short-circuited: an id filter of [] is treated as "no
 * constraint" downstream, which would export everything.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const productIds =
    vendorAdmin?.vendor?.products
      ?.map((product) => product?.id)
      .filter(Boolean) ?? []

  if (!productIds.length) {
    res.status(202).json({ transaction_id: null, count: 0 })
    return
  }

  const { transaction } = await exportProductsWorkflow(req.scope).run({
    input: {
      select: (req.queryConfig?.fields as string[]) ?? ["*"],
      filter: { id: productIds } as Record<string, unknown>,
    },
  })

  res.status(202).json({ transaction_id: transaction.transactionId })
}
