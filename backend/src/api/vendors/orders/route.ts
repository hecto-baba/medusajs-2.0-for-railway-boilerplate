import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Lists the calling vendor's orders.
 *
 * Two hops on purpose: the link only carries order ids, so the ids are read
 * through the vendor admin first and the order details are then fetched by
 * the core workflow, which knows how to compute totals.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.orders.*"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const orderIds =
    vendorAdmin?.vendor?.orders?.map((order) => order?.id).filter(Boolean) ?? []

  // getOrdersListWorkflow with an empty filter would list every order in the
  // store, so a vendor with no orders has to short-circuit here.
  if (!orderIds.length) {
    res.json({ orders: [] })
    return
  }

  const { result: orders } = await getOrdersListWorkflow(req.scope).run({
    input: {
      fields: [
        "metadata",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
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
        filters: { id: orderIds },
      },
    },
  })

  res.json({ orders })
}
