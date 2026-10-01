import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../../../modules/quote"
import { createRequestForQuoteWorkflow } from "../../../../../workflows/create-request-for-quote"

type CreateQuoteType = {
  cart_id: string
  target_price?: number
  note?: string
  delivery_mode?: string
  vehicle_note?: string
  target_shipping_price?: number
  items?: {
    id: string
    quantity: number
    target_unit_price?: number
  }[]
}

export const POST = async (
  req: AuthenticatedMedusaRequest<CreateQuoteType>,
  res: MedusaResponse
) => {
  const {
    cart_id,
    target_price,
    note,
    delivery_mode,
    vehicle_note,
    target_shipping_price,
    items,
  } = (req.body || {}) as CreateQuoteType
  if (!cart_id) {
    return res.status(400).json({ message: "cart_id is required" })
  }

  let customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    try {
      const cartModule = req.scope.resolve(Modules.CART) as any
      const cart = await cartModule.retrieveCart(cart_id)
      if (cart?.customer_id) {
        customerId = cart.customer_id
      }
    } catch {}
  }

  if (customerId) {
    try {
      const {
        result: { quote: createdQuote },
      } = await createRequestForQuoteWorkflow(req.scope).run({
        input: {
          cart_id,
          customer_id: customerId,
          target_price: target_price ? Number(target_price) : undefined,
          note,
          delivery_mode,
          vehicle_note,
          target_shipping_price:
            typeof target_shipping_price === "number"
              ? Number(target_shipping_price)
              : undefined,
          items,
        },
      })

      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const {
        data: [quote],
      } = await query.graph(
        {
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
            "draft_order.items.*",
            "cart.*",
          ],
          filters: { id: createdQuote.id },
        },
        { throwIfKeyNotFound: true }
      )

      return res.json({ quote })
    } catch (workflowErr) {
      console.warn("Workflow quote creation failed, falling back to direct quoteModule:", workflowErr)
    }
  }

  // Fallback direct creation
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK)
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

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  let customerIds: string[] = customerId ? [customerId] : []

  // If customer belongs to a company, include all company employee IDs
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

  const cartId = (req.query?.cart_id as string) || (req.headers["x-medusa-cart-id"] as string)

  try {
    const filterConditions: any[] = []
    if (customerIds.length > 0) {
      filterConditions.push({ customer_id: customerIds })
    }
    if (cartId) {
      filterConditions.push({ cart_id: cartId })
    }

    let quotes: any[] = []
    if (filterConditions.length > 0) {
      const { data } = await query.graph({
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
        ],
        filters: filterConditions.length === 1 ? filterConditions[0] : { $or: filterConditions },
      })
      quotes = data || []
    }

    // Auto-link unassigned quote for this cart to this customer
    if (customerId && cartId) {
      for (const q of quotes) {
        if (!q.customer_id && q.cart_id === cartId) {
          try {
            await quoteModule.updateQuotes({ id: q.id, customer_id: customerId })
            q.customer_id = customerId
          } catch {}
        }
      }
    }

    // Ensure items and totals are clean and accurate for storefront
    for (const q of quotes) {
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
    }

    return res.json({ quotes })
  } catch (error: any) {
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
