import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../modules/quote"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id
  const cartId = (req.query?.cart_id as string) || (req.headers["x-medusa-cart-id"] as string)

  if (!customerId && !cartId) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any

  let customerIds: string[] = customerId ? [customerId] : []
  if (customerId) {
    try {
      const { data: [cust] } = await query.graph({
        entity: "customer",
        fields: ["id", "employee.company.id"],
        filters: { id: customerId },
      })
      const companyId = (cust as any)?.employee?.company?.id
      if (companyId) {
        const { data: employees } = await query.graph({
          entity: "employee",
          fields: ["customer_id"],
          filters: { company_id: companyId },
        })
        for (const emp of employees || []) {
          if (emp.customer_id && !customerIds.includes(emp.customer_id)) {
            customerIds.push(emp.customer_id)
          }
        }
      }
    } catch {}
  }

  try {
    const filterConditions: any[] = []
    if (customerIds.length > 0) {
      filterConditions.push({ customer_id: customerIds })
    }
    if (cartId) {
      filterConditions.push({ cart_id: cartId })
    }

    const { data: quotes } = await query.graph({
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
        "draft_order.*",
        "draft_order.total",
        "draft_order.currency_code",
        "draft_order.items.*",
        "cart.*",
        "cart.total",
        "cart.currency_code",
        "cart.items.*",
        "cart.items.title",
        "cart.items.quantity",
        "cart.items.unit_price",
      ],
      filters: filterConditions.length === 1 ? filterConditions[0] : { $or: filterConditions },
    })

    // Ensure items and totals are clean and accurate for storefront
    for (const q of (quotes || [])) {
      if (q.metadata?.items_negotiated && Array.isArray(q.metadata.items_negotiated)) {
        let computedTotal = 0
        for (const it of q.metadata.items_negotiated) {
          computedTotal += Number(it.quantity || 1) * Number(it.unit_price || 0)
        }
        const shippingFee =
          q.metadata?.admin_shipping_price !== undefined && q.metadata?.admin_shipping_price !== null
            ? Number(q.metadata.admin_shipping_price)
            : 0
        if (computedTotal > 0) {
          if (!q.draft_order) {
            q.draft_order = {}
          }
          q.draft_order.subtotal = computedTotal
          q.draft_order.shipping_total = shippingFee
          q.draft_order.total = computedTotal + shippingFee
          q.draft_order.items = q.metadata.items_negotiated.map((it: any, idx: number) => ({
            id: it.id || `item_${idx}`,
            title: it.title || "Quoted Product",
            quantity: it.quantity,
            unit_price: it.unit_price,
            total: Number(it.quantity) * Number(it.unit_price),
          }))
        }
      }

      if (!q.draft_order) {
        q.draft_order = {}
      }
      q.draft_order.payment_status =
        q.draft_order.metadata?.payment_status ||
        q.metadata?.payment_status ||
        q.draft_order.payment_status ||
        "not_paid"

      q.draft_order.fulfillment_status =
        q.draft_order.metadata?.fulfillment_status ||
        q.metadata?.fulfillment_status ||
        q.draft_order.fulfillment_status ||
        "not_fulfilled"
    }

    return res.json({ quotes: quotes || [] })
  } catch (err: any) {
    try {
      const quotes = await quoteModule.listQuotes(
        customerIds.length > 0 ? { customer_id: customerIds } : {}
      )
      return res.json({ quotes: quotes || [] })
    } catch {
      return res.json({ quotes: [] })
    }
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK)

  const body = (req.body || {}) as any
  const { cart_id, note, target_price, items } = body

  if (!cart_id) {
    return res.status(400).json({ message: "cart_id is required" })
  }

  const messages: any[] = []
  if (note && typeof note === "string" && note.trim().length > 0) {
    messages.push({
      id: `msg_${Date.now()}`,
      sender: "customer",
      sender_name: "Buyer",
      text: note.trim(),
      created_at: new Date().toISOString(),
    })
  }

  const quote = await quoteModule.createQuotes({
    cart_id,
    customer_id: customerId || null,
    status: "pending_merchant",
    metadata: {
      target_price: target_price ? Number(target_price) : null,
      items_requested: items || [],
      messages,
    },
  })

  // Create links
  if (remoteLink) {
    try {
      await remoteLink.create({
        [QUOTE_MODULE]: { quote_id: quote.id },
        cart: { cart_id },
      })
    } catch {}
    if (customerId) {
      try {
        await remoteLink.create({
          [QUOTE_MODULE]: { quote_id: quote.id },
          customer: { customer_id: customerId },
        })
      } catch {}
    }
  }

  return res.status(201).json({ quote })
}
