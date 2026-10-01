import { createStep } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export const notifyRestaurantStepId = "notify-restaurant-step"
export const notifyRestaurantStep = createStep(
  { name: notifyRestaurantStepId, async: true, timeout: 60 * 15, maxRetries: 2 },
  async function (deliveryId: string, { container }) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: [delivery] } = await query.graph({ entity: "deliveries", filters: { id: deliveryId }, fields: ["id", "restaurant.id"] })
    const eventBus = container.resolve(Modules.EVENT_BUS)
    await eventBus.emit({ name: "notify.restaurant", data: { restaurant_id: delivery.restaurant?.id, delivery_id: delivery.id } })
  }
)
