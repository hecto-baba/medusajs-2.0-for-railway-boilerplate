import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getVendorProductIds } from "./helpers"

/**
 * The vendor's enquiry queue: every enquiry on any of THEIR products.
 *
 * Scoped on the session's own product list, never a request field. An empty
 * product list short-circuits to an empty result - passing [] as a filter
 * would mean "no constraint" downstream and return every vendor's enquiries.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { limit = "20", offset = "0", status } = req.query as Record<
    string,
    string
  >

  const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const skip = Math.max(0, parseInt(offset, 10) || 0)

  const productIds = await getVendorProductIds(req)

  if (!productIds.length) {
    res.json({ enquiries: [], count: 0, limit: take, offset: skip })
    return
  }

  const filters: Record<string, any> = { product_id: productIds }
  if (status && ["pending", "responded", "closed"].includes(status)) {
    filters.status = status
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: enquiries, metadata } = await query.graph({
    entity: "enquiry",
    fields: [
      "id",
      "product_id",
      "product.title",
      "customer_email",
      "message",
      "reply",
      "status",
      "responded_at",
      "created_at",
    ],
    filters,
    pagination: {
      take,
      skip,
      order: { created_at: "DESC" },
    },
  })

  res.json({
    enquiries,
    count: metadata?.count ?? enquiries.length,
    limit: take,
    offset: skip,
  })
}
