import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { assertVendorOwns, resolveVendorAdmin } from "../../shared/vendor-scope"
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

  const vendorAdmin = await resolveVendorAdmin(req, ["vendor.products.id"])

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
        "canceled_at",
        "customer_id",
        // Same totals the admin order page reads, so the seller sees the
        // identical Summary (item / shipping / tax / discount / total).
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "original_total",
        "original_tax_total",
        "item_subtotal",
        "item_discount_total",
        "shipping_subtotal",
        "discount_total",
        "shipping_discount_total",
        "summary",
        "customer.*",
        "shipping_address.*",
        "billing_address.*",
        "sales_channel.*",
        "items.*",
        "items.tax_lines",
        "items.adjustments",
        "items.variant",
        "items.variant.product",
        "items.variant.options.*",
        "items.detail",
        "shipping_methods",
        "shipping_methods.tax_lines.*",
        "payment_collections",
        // Named fields only: a payment's `data` holds the gateway's own payload
        // (for Stripe, the payment intent and its client secret).
        "payment_collections.payments.id",
        "payment_collections.payments.amount",
        "payment_collections.payments.currency_code",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.created_at",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
        "payment_collections.payments.refunds.id",
        "payment_collections.payments.refunds.amount",
        "payment_collections.payments.refunds.created_at",
        "payment_collections.payments.refunds.note",
        "fulfillments",
        "fulfillments.labels.*",
        "fulfillments.items.*",
        "shipping_methods.shipping_option_id",
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
  const scopedOrder = scopeOrderToVendor(order, vendorProductIds)

  if (!scopedOrder) {
    // Linked to the seller but none of the items are theirs.
    res.status(404).json({ message: "Order not found." })
    return
  }

  // scopeOrderToVendor swaps the order total for the item subtotal, which
  // drops shipping and tax. When every item is the seller's the real figures
  // are theirs to see (and must match the admin page), so keep them; only a
  // mixed order keeps the withheld/recomputed figures.
  const scoped = scopedOrder.is_mixed
    ? {
        ...scopedOrder,
        // The admin-page figures cover the whole order, other sellers' items
        // included, so they are withheld like the totals above.
        original_total: null,
        original_tax_total: null,
        item_subtotal: null,
        item_discount_total: null,
        shipping_subtotal: null,
        shipping_discount_total: null,
        summary: null,
      }
    : { ...order, items: scopedOrder.items, is_mixed: false }

  const [decorated] = await decorateSplitChildren(req.scope, [scoped])

  // decorateSplitChildren swaps in the parent order's payment status for the
  // list screens. This page shows the order exactly as the admin does, so it
  // keeps the order's own payment collections (and their amounts).
  res.json({ order: { ...decorated, payment_collections: scoped.payment_collections } })
}
