import {
  beginOrderEditOrderWorkflow,
  createOrderWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import {
  CreateOrderLineItemDTO,
} from "@medusajs/framework/types"
import { OrderStatus } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createQuotesStep } from "./steps/create-quotes"

type WorkflowInput = {
  cart_id: string
  customer_id: string
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

export const createRequestForQuoteWorkflow = createWorkflow(
  "create-request-for-quote",
  (input: WorkflowInput) => {
    const { data: carts } = useQueryGraphStep({
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
        "promotions.code",
      ],
      filters: { id: input.cart_id },
      options: {
        throwIfKeyNotFound: true,
      },
    })

    const { data: customers } = useQueryGraphStep({
      entity: "customer",
      fields: ["id", "email"],
      filters: { id: input.customer_id },
      options: {
        throwIfKeyNotFound: true,
      },
    }).config({ name: "customer-query" })

    const orderInput = transform(
      { carts, customers, input },
      ({ carts, customers, input }) => {
        const orderItems = (carts[0].items as CreateOrderLineItemDTO[] || []).map((cartItem: any) => {
          const reqItem = input.items?.find((i: any) => i.id === cartItem.id)
          if (reqItem && Number(reqItem.quantity) > 0) {
            return {
              ...cartItem,
              quantity: Number(reqItem.quantity),
            }
          }
          return cartItem
        })

        return {
          is_draft_order: true,
          status: OrderStatus.DRAFT,
          sales_channel_id: carts[0].sales_channel_id || undefined,
          email: customers[0].email || undefined,
          customer_id: customers[0].id || undefined,
          billing_address: carts[0].billing_address,
          shipping_address: carts[0].shipping_address,
          items: orderItems,
          region_id: carts[0].region_id || undefined,
          promo_codes: carts[0].promotions?.map((promo: any) => promo?.code),
          currency_code: carts[0].currency_code,
          shipping_methods: carts[0].shipping_methods || [],
        } as any
      }
    )

    const draftOrder = createOrderWorkflow.runAsStep({
      input: orderInput,
    })

    const orderEditInput = transform({ draftOrder }, ({ draftOrder }) => {
      return {
        order_id: draftOrder.id,
        description: "",
        internal_note: "",
        metadata: {},
      }
    })

    const changeOrder = beginOrderEditOrderWorkflow.runAsStep({
      input: orderEditInput,
    })

    const quoteData = transform(
      { draftOrder, carts, customers, changeOrder, input },
      ({ draftOrder, carts, customers, changeOrder, input }) => {
        const messages: any[] = []
        if (input.note) {
          messages.push({
            id: `msg_${Date.now()}`,
            sender: "customer",
            sender_name: customers[0].email || "Buyer",
            text: input.note,
            created_at: new Date().toISOString(),
          })
        }

        return {
          draft_order_id: draftOrder.id,
          cart_id: carts[0].id,
          customer_id: customers[0].id,
          order_change_id: changeOrder.id,
          metadata: {
            target_price: input.target_price ? Number(input.target_price) : null,
            target_shipping_price:
              typeof input.target_shipping_price === "number"
                ? Number(input.target_shipping_price)
                : null,
            delivery_mode:
              input.delivery_mode ||
              (input.target_shipping_price === 0
                ? "free_delivery_requested"
                : "custom_budget"),
            vehicle_note: input.vehicle_note || null,
            items_requested: input.items || [],
            messages,
          },
        }
      }
    )

    const quotes = createQuotesStep([quoteData])

    return new WorkflowResponse({ quote: quotes[0] })
  }
)
