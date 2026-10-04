import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { pickWinningRule, PricingRuleLike } from "./pricing"
import type AppointmentBookingModuleService from "../service"

/**
 * Pricing rules make a slot's price depend on its time (peak hours, weekends,
 * seasons). A reschedule charges nothing, so a buyer who could move freely from
 * a cheap slot to a dear one would be skipping the price difference.
 *
 * The check: the same pricing rule must win for the old and the new time (or none
 * at either). Then the price is identical for any base price, with no need to
 * know what was paid. Only buyer-made moves are held to this; the business may
 * move a booking anywhere, and a booking entered by hand has no payment at all.
 *
 * Returns null when there is nothing to protect (no online payment), otherwise a
 * function saying whether a candidate start time keeps the same price.
 */
export const buyerPriceGuard = async (
  container: MedusaContainer,
  service: AppointmentBookingModuleService,
  input: {
    orderId: string | null | undefined
    resourceId: string
    productId: string
    vendorId: string | null | undefined
    timezone: string
    currentStart: Date | string
  }
): Promise<((start: Date) => boolean) | null> => {
  if (!input.orderId || !input.vendorId) return null

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: orders }, rules] = await Promise.all([
    query.graph({
      entity: "order",
      fields: ["id", "currency_code"],
      filters: { id: input.orderId },
    }),
    service.listPricingRules({ vendor_id: input.vendorId, is_active: true }, { take: null }),
  ])
  if (!rules.length) return null

  const currency = ((orders as any[])[0]?.currency_code as string | undefined) ?? ""
  const normalized: PricingRuleLike[] = rules.map((r) => ({
    ...r,
    days_of_week: (r.days_of_week as unknown as number[] | null) ?? null,
  }))

  const winnerAt = (start: Date) =>
    pickWinningRule(normalized, {
      resource_id: input.resourceId,
      product_id: input.productId,
      start,
      timezone: input.timezone,
      currency_code: currency,
    })?.id ?? null

  const current = winnerAt(new Date(input.currentStart))
  return (start: Date) => winnerAt(start) === current
}

export const PRICED_DIFFERENTLY =
  "That time is priced differently, so it cannot be changed online. Please choose a time at the same price or contact the business."
