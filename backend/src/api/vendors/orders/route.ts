import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"

export const GetVendorOrdersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Lists the calling vendor's orders, paginated.
 *
 * Two hops on purpose: the link only carries order ids, so the ids are read
 * through the vendor admin first and the order details are then fetched by
 * the core workflow, which knows how to compute totals.
 *
 * The page is taken from the id list before the second hop rather than from
 * the workflow's own pagination. The vendor's order ids are already in hand,
 * so slicing here fetches details for one page instead of for the vendor's
 * entire order history.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorOrdersSchema
  >

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.orders.*"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const allOrders = vendorAdmin?.vendor?.orders ?? []

  // Newest first, matching what the admin's order list shows. The link
  // traversal has no ordering of its own, so without this the page contents
  // would be arbitrary and could shift between requests.
  const sortedIds = allOrders
    .filter(Boolean)
    .sort((a, b) =>
      new Date(b!.created_at as string).getTime() -
      new Date(a!.created_at as string).getTime()
    )
    .map((order) => order!.id)

  const count = sortedIds.length
  const pageIds = sortedIds.slice(offset, offset + limit)

  // getOrdersListWorkflow with an empty filter would list every order in the
  // store, so an empty page has to short-circuit here.
  if (!pageIds.length) {
    res.json({ orders: [], count, limit, offset })
    return
  }

  const { result: orders } = await getOrdersListWorkflow(req.scope).run({
    input: {
      fields: [
        "id",
        "display_id",
        "status",
        "created_at",
        "email",
        "currency_code",
        "metadata",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "customer.*",
        "sales_channel.*",
        "items.*",
        "items.tax_lines",
        "items.adjustments",
        "items.variant",
        "items.variant.product",
        "items.detail",
        "shipping_methods",
        "payment_collections",
        "fulfillments",
      ],
      variables: {
        filters: { id: pageIds },
      },
    },
  })

  // getOrdersListWorkflow returns either a bare array or a { rows, metadata }
  // envelope depending on how it was invoked, and its output type is the union
  // of both. Normalising here keeps the narrowing in one place.
  const orderRows = Array.isArray(orders) ? orders : orders.rows

  // The workflow does not preserve the id order it was given, so the page is
  // re-sorted to match the order the ids were paged in.
  const orderById = new Map(orderRows.map((order) => [order.id, order]))
  const pageOrders = pageIds
    .map((id) => orderById.get(id))
    .filter((order): order is NonNullable<typeof order> => Boolean(order))

  res.json({ orders: pageOrders, count, limit, offset })
}
