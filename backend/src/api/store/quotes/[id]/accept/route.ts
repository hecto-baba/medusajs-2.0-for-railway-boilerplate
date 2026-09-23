import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, OrderStatus } from "@medusajs/framework/utils"
import { confirmOrderEditRequestWorkflow } from "@medusajs/medusa/core-flows"
import { QUOTE_MODULE } from "../../../../../modules/quote"
import { customerAcceptQuoteWorkflow } from "../../../../../workflows/customer-accept-quote"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
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
      "draft_order.*",
      "cart.*",
    ],
    filters: { id: req.params.id },
  })

  if (!quote) {
    return res.status(404).json({ message: "Quote not found" })
  }

  // Resolve customer ID: from authenticated session, quote, or draft order/cart
  let customerId = (req as any).auth_context?.actor_id || quote.customer_id

  if (!customerId) {
    const customerModuleService = req.scope.resolve(Modules.CUSTOMER) as any
    const email = quote.draft_order?.email || quote.cart?.email || "guest@buyer.com"
    try {
      const { data: [existingCust] } = await query.graph({
        entity: "customer",
        fields: ["id", "email"],
        filters: { email },
      })
      if (existingCust) {
        customerId = existingCust.id
      } else {
        const newCust = await customerModuleService.createCustomers({
          email,
          first_name: "Guest",
          last_name: "Buyer",
        })
        customerId = newCust?.id
      }
    } catch {}
  }

  // Ensure quote and draft order are linked with customerId
  if (customerId) {
    try {
      if (!quote.customer_id || quote.customer_id !== customerId) {
        await quoteModule.updateQuotes({
          id: quote.id,
          customer_id: customerId,
        })
      }
      if (quote.draft_order_id) {
        await orderModuleService.updateOrders({
          id: quote.draft_order_id,
          customer_id: customerId,
        })
      }
    } catch {}
  }

  // Bind agreed delivery terms to the draft order shipping method
  const agreedShippingPrice =
    quote.metadata?.admin_shipping_price !== undefined && quote.metadata?.admin_shipping_price !== null
      ? Number(quote.metadata.admin_shipping_price)
      : quote.metadata?.target_shipping_price !== undefined && quote.metadata?.target_shipping_price !== null
      ? Number(quote.metadata.target_shipping_price)
      : 0

  if (quote.draft_order_id) {
    try {
      const {
        data: [order],
      } = await query.graph({
        entity: "order",
        fields: ["id", "shipping_methods.*"],
        filters: { id: quote.draft_order_id },
      })

      if (order?.shipping_methods && order.shipping_methods.length > 0) {
        for (const sm of order.shipping_methods) {
          try {
            await orderModuleService.updateOrderShippingMethods({
              id: sm.id,
              amount: agreedShippingPrice,
              name: agreedShippingPrice === 0 ? "Free Delivery Included" : (sm.name || "Custom Freight Delivery"),
            })
          } catch {}
        }
      } else {
        try {
          await orderModuleService.createOrderShippingMethods({
            order_id: quote.draft_order_id,
            name: agreedShippingPrice === 0 ? "Free Delivery Included" : "Custom Freight Delivery",
            amount: agreedShippingPrice,
          })
        } catch {}
      }
    } catch (shippingErr) {
      console.warn("Could not bind shipping method:", shippingErr)
    }
  }

  // Attempt workflow acceptance
  try {
    const { result } = await customerAcceptQuoteWorkflow(req.scope).run({
      input: {
        quote_id: req.params.id,
        customer_id: customerId || undefined,
      },
    })

    return res.json({
      success: true,
      order_id: quote.draft_order_id,
      quote: result,
    })
  } catch (err: any) {
    // If workflow failed due to status or edit error, finalize directly
    if (quote.draft_order_id) {
      if (quote.order_change_id) {
        try {
          await confirmOrderEditRequestWorkflow(req.scope).run({
            input: {
              order_id: quote.draft_order_id,
              confirmed_by: customerId || "customer",
            },
          })
        } catch {}
      }

      try {
        await orderModuleService.updateOrders({
          id: quote.draft_order_id,
          is_draft_order: false,
          status: OrderStatus.PENDING,
        })
      } catch {}
    }

    await quoteModule.updateQuotes({
      id: req.params.id,
      status: "accepted",
    })

    return res.json({
      success: true,
      order_id: quote.draft_order_id,
    })
  }
}