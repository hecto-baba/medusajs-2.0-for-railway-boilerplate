import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../modules/appointment-booking"
import type AppointmentBookingModuleService from "../modules/appointment-booking/service"

/**
 * A product can be sold in one way only: asked about (enquiry), rented,
 * booked as an appointment, sold with an Expression of Interest, or sold as
 * a ticket. Enabling one while another is active is rejected.
 *
 * What counts as "active":
 *   enquiry     enquiry_configuration.status = "active"
 *   rental      rental_configuration.status = "active"
 *   eoi         any variant of the product with eoi_configuration.status = "active"
 *   appointment any provider offering the product (service_provider row)
 *   ticketing   a ticket_product row for the product
 *
 * The check and the write that follows it are two steps, so two requests
 * enabling different modes at the same moment could both pass the check.
 * withSaleModeLock serialises them per product: callers wrap check + write in
 * it, and every mode's write path does, so they all queue on the same key.
 */
export type SaleMode = "enquiry" | "rental" | "appointment" | "eoi" | "ticketing"

const MODE_LABEL: Record<SaleMode, string> = {
  enquiry: "Enquiries",
  rental: "Rental",
  appointment: "Appointment booking",
  eoi: "Expression of Interest",
  ticketing: "Ticketing",
}

/**
 * Active sale modes for many products in a fixed number of queries (five),
 * however many products are asked about - never one round of queries per
 * product.
 */
export const getActiveSaleModesFor = async (
  container: MedusaContainer,
  productIds: string[]
): Promise<Map<string, SaleMode[]>> => {
  const ids = [...new Set(productIds)]
  const result = new Map<string, SaleMode[]>(ids.map((id) => [id, []]))

  if (!ids.length) {
    return result
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const appointmentService: AppointmentBookingModuleService = container.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const [enquiry, rental, variants, tickets, offerings] = await Promise.all([
    query.graph({
      entity: "enquiry_configuration",
      fields: ["product_id"],
      filters: { product_id: ids, status: "active" },
    }),
    query.graph({
      entity: "rental_configuration",
      fields: ["product_id"],
      filters: { product_id: ids, status: "active" },
    }),
    query.graph({
      entity: "product_variant",
      fields: ["id", "product_id", "eoi_configuration.status"],
      filters: { product_id: ids },
    }),
    query.graph({
      entity: "ticket_product",
      fields: ["product_id"],
      filters: { product_id: ids },
    }),
    appointmentService.listServiceProviders(
      { service_product_id: ids },
      { select: ["service_product_id"], take: null }
    ),
  ])

  const add = (productId: string | undefined, mode: SaleMode) => {
    const modes = productId ? result.get(productId) : undefined
    if (modes && !modes.includes(mode)) modes.push(mode)
  }

  enquiry.data.forEach((row: any) => add(row.product_id, "enquiry"))
  rental.data.forEach((row: any) => add(row.product_id, "rental"))
  ;(variants.data as any[]).forEach((variant) => {
    if (variant?.eoi_configuration?.status === "active") {
      add(variant.product_id, "eoi")
    }
  })
  tickets.data.forEach((row: any) => add(row.product_id, "ticketing"))
  offerings.forEach((row) => add(row.service_product_id, "appointment"))

  return result
}

/**
 * Throws if any of the products already runs in a sale mode other than
 * `mode`. One batched lookup for the whole list.
 *
 * INVALID_DATA, not NOT_ALLOWED: this is a bad combination of settings the
 * user can fix by turning the other mode off, and the message says which.
 */
export const assertNoOtherSaleModeForProducts = async (
  container: MedusaContainer,
  productIds: string[],
  mode: SaleMode
): Promise<void> => {
  const active = await getActiveSaleModesFor(container, productIds)

  for (const modes of active.values()) {
    const others = modes.filter((m) => m !== mode)

    if (others.length) {
      const names = others.map((other) => MODE_LABEL[other]).join(", ")

      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A product can only use one sale mode. ${MODE_LABEL[mode]} cannot be turned on while ${names} is active - turn that off first.`
      )
    }
  }
}

export const assertNoOtherSaleMode = (
  container: MedusaContainer,
  productId: string,
  mode: SaleMode
): Promise<void> => assertNoOtherSaleModeForProducts(container, [productId], mode)

/** The product a variant belongs to, or undefined if the variant is missing. */
export const getProductIdOfVariant = async (
  container: MedusaContainer,
  variantId: string
): Promise<string | undefined> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [variant],
  } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product_id"],
    filters: { id: variantId },
  })

  return variant?.product_id ?? undefined
}

/**
 * Runs `job` while holding a lock on each product, so a sale-mode check and
 * the write that depends on it cannot interleave with another mode's. Keys
 * are sorted so two callers locking the same products cannot deadlock. Waits
 * up to 10 seconds for the lock, then fails rather than hanging the request.
 */
export const withSaleModeLock = async <T>(
  container: MedusaContainer,
  productIds: string[],
  job: () => Promise<T>
): Promise<T> => {
  const keys = [...new Set(productIds)].sort().map((id) => `sale-mode:${id}`)

  if (!keys.length) {
    return job()
  }

  const locking = container.resolve(Modules.LOCKING)

  return locking.execute(keys, job, { timeout: 10 })
}
