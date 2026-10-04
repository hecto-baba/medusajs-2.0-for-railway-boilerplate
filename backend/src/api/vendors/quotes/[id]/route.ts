import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../../modules/quote"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = req.scope.resolve(Modules.ORDER) as any

  const {
    data: [quote],
  } = await query.graph({
    entity: "quote",
    fields: [
      "id",
      "status",
      "customer_id",
      "draft_order_id",
      "order_change_id",
      "cart_id",
      "metadata",
      "created_at",
      "customer.*",
      "customer.employee.*",
      "customer.employee.company.*",
      "draft_order.*",
      "draft_order.total",
      "draft_order.subtotal",
      "draft_order.currency_code",
      "draft_order.items.*",
      "draft_order.shipping_address.*",
      "cart.*",
      "cart.items.*",
    ],
    filters: { id: req.params.id },
  })

  if (!quote) {
    return res.status(404).json({ message: "Quote not found" })
  }

  let orderPreview = null
  if (quote.draft_order_id) {
    try {
      orderPreview = await orderModuleService.previewOrderChange(quote.draft_order_id)
    } catch (e: any) {}
  }

  if (quote.metadata?.items_negotiated && Array.isArray(quote.metadata.items_negotiated)) {
    let computedTotal = 0
    for (const it of quote.metadata.items_negotiated) {
      computedTotal += Number(it.quantity || 1) * Number(it.unit_price || 0)
    }
    const shippingFee =
      quote.metadata?.admin_shipping_price !== undefined && quote.metadata?.admin_shipping_price !== null
        ? Number(quote.metadata.admin_shipping_price)
        : (quote.metadata?.vendor_shipping_price !== undefined ? Number(quote.metadata.vendor_shipping_price) : 0)
    if (computedTotal > 0) {
      if (!quote.draft_order) {
        quote.draft_order = {}
      }
      quote.draft_order.subtotal = computedTotal
      quote.draft_order.shipping_total = shippingFee
      quote.draft_order.total = computedTotal + shippingFee
      if (!quote.draft_order.items || quote.draft_order.items.length === 0) {
        quote.draft_order.items = quote.metadata.items_negotiated.map((it: any, idx: number) => ({
          id: it.id || `item_${idx}`,
          title: it.title || "Quoted Product",
          quantity: it.quantity,
          unit_price: it.unit_price,
          total: Number(it.quantity) * Number(it.unit_price),
        }))
      }
    }
  }

  if (!quote.draft_order) {
    quote.draft_order = {}
  }
  quote.draft_order.payment_status =
    quote.draft_order.metadata?.payment_status ||
    quote.metadata?.payment_status ||
    quote.draft_order.payment_status ||
    "not_paid"

  quote.draft_order.fulfillment_status =
    quote.draft_order.metadata?.fulfillment_status ||
    quote.metadata?.fulfillment_status ||
    quote.draft_order.fulfillment_status ||
    "not_fulfilled"

  return res.json({ quote, order_preview: orderPreview })
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  const body = (req.body || {}) as any

  const updateData: Record<string, any> = {
    id: req.params.id,
  }

  if (body.status) {
    updateData.status = body.status
  }

  const existingQuote = await quoteModule.retrieveQuote(req.params.id)
  const currentMeta = (existingQuote?.metadata || {}) as Record<string, any>

  const newMeta: Record<string, any> = {
    ...currentMeta,
  }

  if (body.items_negotiated) {
    newMeta.items_negotiated = body.items_negotiated
  }

  if (body.vendor_shipping_price !== undefined || body.admin_shipping_price !== undefined) {
    const fee = body.vendor_shipping_price ?? body.admin_shipping_price
    newMeta.admin_shipping_price = fee
    newMeta.vendor_shipping_price = fee
  }

  if (body.metadata) {
    Object.assign(newMeta, body.metadata)
  }

  updateData.metadata = newMeta

  const quote = await quoteModule.updateQuotes(updateData)
  return res.status(200).json({ quote })
}
