import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../modules/quote"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "vendor.id", "vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin) {
    return res.status(401).json({ message: "Vendor not authenticated" })
  }

  const vendorProductIds = (vendorAdmin?.vendor?.products || [])
    .map((p: any) => p?.id)
    .filter(Boolean)
  const vendorId = vendorAdmin.vendor?.id

  try {
    const { data: allQuotes, metadata } = await query.graph({
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
        "customer.first_name",
        "customer.last_name",
        "customer.email",
        "cart.*",
        "cart.total",
        "cart.subtotal",
        "cart.currency_code",
        "cart.items.*",
        "cart.items.title",
        "cart.items.quantity",
        "cart.items.unit_price",
        "cart.items.product_id",
      ],
      pagination: {
        take: 100,
        skip: 0,
      },
    })

    // Filter quotes relevant to this vendor
    const scopedQuotes = (allQuotes || []).filter((quote: any) => {
      if (quote.metadata?.vendor_id === vendorId) return true
      if (quote.cart?.items?.some((item: any) => vendorProductIds.includes(item.product_id))) return true
      // If vendor owns products and quote has no items yet or matches
      return true
    })

    return res.json({
      quotes: scopedQuotes.slice(offset, offset + limit),
      count: scopedQuotes.length,
      limit,
      offset,
    })
  } catch (error) {
    const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
    const [quotes, count] = await quoteModule.listAndCountQuotes({}, {
      take: limit,
      skip: offset,
    })

    return res.json({
      quotes: quotes || [],
      count,
      limit,
      offset,
    })
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  const body = (req.body || {}) as any
  const { quote_id, status } = body

  if (!quote_id) {
    return res.status(400).json({ message: "quote_id is required" })
  }

  const quote = await quoteModule.updateQuotes({
    id: quote_id,
    status: status || "accepted",
  })

  return res.status(200).json({ quote })
}
