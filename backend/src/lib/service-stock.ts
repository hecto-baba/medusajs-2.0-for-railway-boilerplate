import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../modules/appointment-booking"
import type AppointmentBookingModuleService from "../modules/appointment-booking/service"

/**
 * A bookable service has no stock to count: whether a time can be booked is
 * decided by the slot engine and the database, not by an inventory level.
 * Leaving Medusa's stock tracking on for a service's variants makes it refuse the
 * booking at add-to-cart with "not associated with any stock location", because
 * the variant has no stock anywhere.
 *
 * So a product that is offered as a service has stock tracking switched off on
 * every variant. Only variants still tracking are touched, so calling this again
 * is a cheap no-op. Switching it off leaves the variant's inventory item alone;
 * if a seller later stops offering the product, tracking stays off (the real
 * stock is unknown) and they can turn it back on deliberately.
 *
 * Returns how many variants were changed.
 */
export const disableStockTracking = async (
  container: MedusaContainer,
  productIds: string[]
): Promise<number> => {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (!ids.length) return 0

  const products: any = container.resolve(Modules.PRODUCT)
  const tracking = await products.listProductVariants(
    { product_id: ids, manage_inventory: true },
    { select: ["id"], take: null }
  )
  if (!tracking.length) return 0

  await products.updateProductVariants(
    { id: tracking.map((v: { id: string }) => v.id) },
    { manage_inventory: false }
  )
  return tracking.length
}

/** Whether any resource currently offers this product as a service. */
export const isOfferedAsService = async (
  container: MedusaContainer,
  productId: string
): Promise<boolean> => {
  const service: AppointmentBookingModuleService = container.resolve(
    APPOINTMENT_BOOKING_MODULE
  )
  const [offering] = await service.listServiceProviders(
    { service_product_id: productId },
    { select: ["id"], take: 1 }
  )
  return !!offering
}
