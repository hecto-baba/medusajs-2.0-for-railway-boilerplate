import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { assertVendorOwns } from "../../shared/vendor-scope"
import { decorateSplitChildren, scopeOrderToVendor } from "../helpers"

/**
 * A single order, scoped to the calling vendor - the by-id counterpart to
 * GET /vendors/orders. Applies the identical cross-vendor privacy rules as
 * the list route (redact line items/financials belonging to other vendors in
 * a multi-vendor cart), rather than reusing the list route's own filtering
 * inline: assertVendorOwns already proves the order is at least partially
 * theirs before this ever fetches or scopes anything.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwns(req, "orders", id, "Order not found.")

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorProductIds = new Set<string>(
    (vendorAdmin?.vendor?.products || [])
      .map((p: any) => p?.id)
      .filter((productId: any) => typeof productId === "string" && productId.length > 0)
  )

  const { result: rawOrders } = await getOrdersListWorkflow(req.scope).run({
    input: {
      fields: [
        "id",
        "display_id",
        "status",
        "created_at",
        "currency_code",
        "email",
        "metadata",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "customer.*",
        "shipping_address.*",
        "billing_address.*",
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
        filters: { id: [id] },
      },
    },
  })

  const orderRows = Array.isArray(rawOrders)
    ? rawOrders
    : (rawOrders as any)?.rows || []

  const order = orderRows[0]

  if (!order) {
    res.status(404).json({ message: "Order not found." })
    return
  }

  // Keep only this vendor's items, and withhold whole-order figures when the
  // order also holds other sellers' items (see ../helpers.ts).
  const scoped = scopeOrderToVendor(order, vendorProductIds)

  if (!scoped) {
    // Linked to the seller but none of the items are theirs.
    res.status(404).json({ message: "Order not found." })
    return
  }

  const [decorated] = await decorateSplitChildren(req.scope, [scoped])

  res.json({ order: decorated })
}
