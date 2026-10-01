import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, ChangeActionType, OrderStatus } from "@medusajs/framework/utils"
import { beginOrderEditOrderWorkflow } from "@medusajs/medusa/core-flows"
import { QUOTE_MODULE } from "../../../../../modules/quote"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = req.scope.resolve(Modules.ORDER) as any
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK) as any

  const {
    data: [quote],
  } = await query.graph({
    entity: "quote",
    fields: ["id", "draft_order_id", "order_change_id", "cart_id", "status", "metadata"],
    filters: { id: req.params.id },
  })

  if (!quote) {
    return res.status(404).json({ message: "Quote not found" })
  }

  if (quote.status === "accepted") {
    return res.status(400).json({
      message: "Quote items cannot be modified after the quote has been accepted.",
    })
  }


  const { items, shipping_price } = (req.body || {}) as {
    items?: { id: string; quantity?: number; unit_price?: number }[]
    shipping_price?: number
  }

  if ((!items || !items.length) && typeof shipping_price !== "number") {
    return res.status(400).json({ message: "items or shipping_price is required" })
  }

  let draftOrderId = quote.draft_order_id
  let orderChangeId = quote.order_change_id

  // Auto-create draft order if missing on this quote
  if (!draftOrderId && quote.cart_id) {
    const { data: [cart] } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "sales_channel_id",
        "currency_code",
        "region_id",
        "customer.id",
        "customer.email",
        "shipping_address.*",
        "billing_address.*",
        "items.*",
        "shipping_methods.*",
      ],
      filters: { id: quote.cart_id },
    })

    if (cart) {
      const orderItems = (cart.items || []).map((cartItem: any) => ({
        title: cartItem.title,
        quantity: Number(cartItem.quantity || 1),
        unit_price: Number(cartItem.unit_price || 0),
        variant_id: cartItem.variant_id,
        thumbnail: cartItem.thumbnail,
      }))

      const draftOrder = await orderModuleService.createOrders({
        is_draft_order: true,
        status: OrderStatus.DRAFT,
        sales_channel_id: cart.sales_channel_id || undefined,
        email: cart.customer?.email || cart.email || "guest@buyer.com",
        customer_id: cart.customer?.id || undefined,
        billing_address: cart.billing_address,
        shipping_address: cart.shipping_address,
        items: orderItems,
        region_id: cart.region_id || undefined,
        currency_code: cart.currency_code,
        shipping_methods: cart.shipping_methods || [],
      })

      draftOrderId = draftOrder.id

      try {
        const { result: changeOrder } = await beginOrderEditOrderWorkflow(req.scope).run({
          input: {
            order_id: draftOrderId,
          },
        })
        orderChangeId = changeOrder?.id
      } catch (err: any) {
        console.warn("beginOrderEditOrderWorkflow warning:", err?.message)
      }

      await quoteModule.updateQuotes({
        id: quote.id,
        draft_order_id: draftOrderId,
        ...(orderChangeId ? { order_change_id: orderChangeId } : {}),
      })

      if (remoteLink) {
        try {
          await remoteLink.create({
            [QUOTE_MODULE]: { quote_id: quote.id },
            order: { draft_order_id: draftOrderId },
          })
          if (orderChangeId) {
            await remoteLink.create({
              [QUOTE_MODULE]: { quote_id: quote.id },
              orderChange: { order_change_id: orderChangeId },
            })
          }
        } catch {}
      }
    }
  }

  // Update line items directly and via order change actions
  if (items && items.length && draftOrderId) {
    try {
      const order = await orderModuleService.retrieveOrder(draftOrderId, { relations: ["items"] })
      const lineItems = (order as any).items || []
      for (const item of items) {
        // Find matching draft order line item
        const matchingLine =
          lineItems.find((li: any) => li.id === item.id) ||
          lineItems.find((li: any) => li.title && li.title === (item as any).title) ||
          lineItems[0]

        if (matchingLine && item.unit_price !== undefined) {
          try {
            await orderModuleService.updateOrderLineItems({
              id: matchingLine.id,
              unit_price: Number(item.unit_price),
            })
          } catch {}

          if (orderChangeId) {
            try {
              await orderModuleService.createOrderChangeActions({
                order_change_id: orderChangeId,
                order_id: draftOrderId,
                action: ChangeActionType.ITEM_UPDATE,
                reference: "order_item",
                reference_id: matchingLine.id,
                details: {
                  reference_id: matchingLine.id,
                  quantity: matchingLine.quantity,
                  unit_price: Number(item.unit_price),
                },
              })
            } catch {}
          }
        }
      }
    } catch (updateErr) {
      console.warn("Could not update line items on draft order:", updateErr)
    }
  }

  // Save negotiated items in quote metadata for quick display & storefront syncing
  const nextStatus =
    quote.status === "merchant_rejected" || quote.status === "customer_rejected"
      ? "pending_merchant"
      : quote.status

  try {
    await quoteModule.updateQuotes({
      id: quote.id,
      status: nextStatus,
      metadata: {
        ...(quote.metadata || {}),
        items_negotiated: items || quote.metadata?.items_negotiated || [],
        admin_shipping_price: typeof shipping_price === "number" ? Number(shipping_price) : quote.metadata?.admin_shipping_price,
      },
    })
  } catch (metaErr) {}

  let orderPreview = null
  if (draftOrderId) {
    try {
      orderPreview = await orderModuleService.previewOrderChange(draftOrderId)
    } catch (e) {}
  }

  return res.json({
    success: true,
    order_preview: orderPreview,
  })
}
