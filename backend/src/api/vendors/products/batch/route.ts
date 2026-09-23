import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  batchProductsWorkflow,
  createLinksWorkflow,
} from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../../modules/marketplace"
import { assertOwnership, getVendorId } from "../helpers"

/**
 * Creates, updates and deletes several of the vendor's products in one call.
 *
 * This is the highest-risk route in the vendor product set, because unlike
 * every other one it both *writes rows that do not exist yet* and *acts on ids
 * supplied in the body*. Two separate things therefore have to hold:
 *
 *  - update and delete may only name products the vendor already owns, so each
 *    id is ownership-checked before the workflow runs. Skipping this would let
 *    a vendor edit or delete any product in the store by id.
 *
 *  - products created here must be linked to the vendor, exactly as the single
 *    create route does. An unlinked product belongs to nobody: it would not
 *    appear in the vendor's own list, and no ownership check would ever pass
 *    for it, leaving an orphan row only a platform admin could clean up.
 *
 * The link is written after the workflow rather than inside it because
 * batchProductsWorkflow is a core flow and cannot be extended with a link
 * step; createLinksWorkflow is the runnable equivalent of the step the single
 * create route uses inside its own workflow.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = req.validatedBody as {
    create?: Record<string, any>[]
    update?: { id: string }[]
    delete?: string[]
  }

  const touchedIds = [
    ...(body.update?.map((product) => product.id) ?? []),
    ...(body.delete ?? []),
  ].filter(Boolean)

  // Checked one at a time rather than in a single query: assertOwnership reads
  // the vendor's whole product id list per call, so a batched variant would
  // need its own traversal. Batches here are small (a grid save, not an
  // import), and reusing the audited guard is worth more than the round trips.
  for (const productId of new Set(touchedIds)) {
    await assertOwnership(req, productId)
  }

  const vendorId = await getVendorId(req)

  // A created product with no sales channel is invisible to the storefront,
  // and a vendor has no way to choose one - so the store default is applied,
  // matching createVendorProductWorkflow.
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["default_sales_channel_id"],
  })

  const defaultSalesChannelId = stores[0]?.default_sales_channel_id

  if (body.create?.length && !defaultSalesChannelId) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The store has no default sales channel, so products cannot be created."
    )
  }

  const { result } = await batchProductsWorkflow(req.scope).run({
    input: {
      create: body.create?.map((product) => ({
        ...product,
        sales_channels: [{ id: defaultSalesChannelId }],
      })) as any,
      update: body.update as any,
      delete: body.delete,
    },
  })

  if (result.created?.length) {
    await createLinksWorkflow(req.scope).run({
      input: result.created.map((product) => ({
        [MARKETPLACE_MODULE]: { vendor_id: vendorId },
        [Modules.PRODUCT]: { product_id: product.id },
      })),
    })
  }

  res.status(200).json({
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
  })
}
