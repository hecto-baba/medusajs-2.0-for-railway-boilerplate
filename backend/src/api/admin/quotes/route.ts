import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../modules/quote"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

  try {
    const { data: quotes, metadata } = await query.graph({
      entity: "quote",
      fields: [
        "id",
        "status",
        "customer_id",
        "draft_order_id",
        "order_change_id",
        "cart_id",
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
      ],
      pagination: {
        take: limit,
        skip: offset,
      },
    })

    return res.json({
      quotes,
      count: metadata?.count ?? quotes.length,
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
      quotes,
      count,
      limit,
      offset,
    })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
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
