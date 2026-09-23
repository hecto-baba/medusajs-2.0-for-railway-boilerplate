import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DELIVERY_MODULE } from "../modules/delivery"
import { DeliveryStatus } from "../modules/delivery/types"

export default async function seedDeliveries({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const deliveryModuleService = container.resolve(DELIVERY_MODULE) as any

  logger.info("Seeding dummy drivers...")

  // Create dummy drivers
  const driver1 = await deliveryModuleService.createDrivers({
    first_name: "John",
    last_name: "Doe",
    email: "john.doe@example.com",
    phone: "+1 555-0101",
  })

  const driver2 = await deliveryModuleService.createDrivers({
    first_name: "Jane",
    last_name: "Smith",
    email: "jane.smith@example.com",
    phone: "+1 555-0102",
  })

  logger.info("Seeding dummy deliveries...")

  // Create dummy deliveries with different statuses
  await deliveryModuleService.createDeliveries({
    delivery_status: DeliveryStatus.PENDING,
    eta: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    driver_id: null,
  })

  await deliveryModuleService.createDeliveries({
    delivery_status: DeliveryStatus.IN_TRANSIT,
    eta: new Date(Date.now() + 30 * 60 * 1000), // 30 mins from now
    driver_id: driver1.id,
  })

  await deliveryModuleService.createDeliveries({
    delivery_status: DeliveryStatus.DELIVERED,
    eta: new Date(Date.now() - 60 * 60 * 1000),
    delivered_at: new Date(),
    driver_id: driver2.id,
  })

  logger.info("Finished seeding delivery and driver data.")
}
