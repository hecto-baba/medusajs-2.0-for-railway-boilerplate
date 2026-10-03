import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { CreateOrderShippingMethodDTO } from "@medusajs/framework/types"
import { DELIVERY_MODULE } from "../../../modules/delivery"

export const createOrderStep = createStep(
  "create-order-step",
  async function (deliveryId: string, { container }) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: [delivery] } = await query.graph({
      entity: "deliveries",
      fields: [
        "id",
        "cart.*",
        "cart.shipping_address.*",
        "cart.billing_address.*",
        "cart.items.*",
        "cart.shipping_methods.*",
      ],
      filters: { id: deliveryId },
    })
    const { cart } = delivery as any
    if (!cart) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Cart for delivery with id: ${deliveryId} was not found`
      )
    }
    const orderModuleService = container.resolve(Modules.ORDER) as any
    const order = await orderModuleService.createOrders({
      currency_code: cart.currency_code,
      email: cart.email,
      shipping_address: {
        first_name: cart.shipping_address?.first_name || "",
        last_name: cart.shipping_address?.last_name || "",
        address_1: cart.shipping_address?.address_1 || "",
        city: cart.shipping_address?.city || "",
        postal_code: cart.shipping_address?.postal_code || "",
        country_code: cart.shipping_address?.country_code || "",
      },
      items: cart.items.map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
        variant_id: item.variant_id || "",
        unit_price: item.unit_price,
        product_id: item.product_id || "",
      })),
      // Marks this as the delivery module's own copy of the buyer's order. It has
      // no payment and is never announced as placed, so it is not split or linked
      // to a seller here; restaurant sellers get their deliveries in Phase 5.
      metadata: { delivery_order: true, delivery_id: delivery.id },
      region_id: cart.region_id || "",
      customer_id: cart.customer_id || "",
      sales_channel_id: cart.sales_channel_id || "",
      shipping_methods:
        cart.shipping_methods?.map(
          (sm: any): CreateOrderShippingMethodDTO => ({
            shipping_option_id: sm?.shipping_option_id || "",
            name: sm?.name || "",
            amount: sm?.amount || 0,
            order_id: "",
          })
        ) || [],
    })
    const linkDef = [
      {
        [DELIVERY_MODULE]: { delivery_id: delivery.id },
        [Modules.ORDER]: { order_id: order.id },
      },
    ]
    return new StepResponse({ order, linkDef }, { orderId: order.id })
  },
  async function (data, { container }) {
    if (!data) return
    const orderService = container.resolve(Modules.ORDER) as any
    await orderService.softDeleteOrders([data.orderId])
  }
)
