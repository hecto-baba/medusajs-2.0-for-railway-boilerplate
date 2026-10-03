import {
  ContainerRegistrationKeys,
  MedusaError,
  QueryContext,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"
import { applyPricingRules } from "../../modules/appointment-booking/lib/pricing"

export type PrepareAppointmentBookingInput = {
  cart_id: string
  resource_id: string
  variant_id: string
  start: string | Date
}

export const MAX_APPOINTMENTS_PER_CART = 10

// Currencies Medusa prices without minor units.
const ZERO_DECIMAL = new Set(["jpy", "krw", "vnd", "clp", "pyg", "ugx", "xaf", "xof", "xpf", "bif", "djf", "gnf", "kmf", "rwf", "vuv"])

/**
 * Everything that can be checked BEFORE a place is reserved, so a bad request
 * never leaves a hold behind:
 *
 *  - the cart exists, is open, and does not already hold this slot
 *  - the resource is active and the variant is a published variant of a service
 *    this resource actually offers. This is what closes the "pair an expensive
 *    slot with a $1 variant" hole: the price comes from the variant, so the
 *    variant must be one the resource really sells.
 *  - the price, computed on the server: the variant's price in the cart's
 *    region/currency, then the vendor's pricing rules. A client-supplied price
 *    is never read.
 */
export const prepareAppointmentBookingStep = createStep(
  "prepare-appointment-booking",
  async (input: PrepareAppointmentBookingInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const start = new Date(input.start)

    if (Number.isNaN(start.getTime())) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid start time.")
    }

    const {
      data: [cart],
    } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "currency_code",
        "region_id",
        "customer_id",
        "completed_at",
        "items.id",
        "items.metadata",
      ],
      filters: { id: input.cart_id },
    })

    if (!cart) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found.")
    }
    if (cart.completed_at) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This cart is already completed.")
    }

    const appointmentLines = (cart.items ?? []).filter(
      (i: any) => i?.metadata?.attendee_id
    ) as any[]

    if (appointmentLines.length >= MAX_APPOINTMENTS_PER_CART) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `A cart can hold at most ${MAX_APPOINTMENTS_PER_CART} appointments.`
      )
    }
    if (
      appointmentLines.some(
        (i) =>
          i.metadata.resource_id === input.resource_id &&
          new Date(i.metadata.start_time).getTime() === start.getTime()
      )
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This time is already in your cart."
      )
    }

    const [resource] = await service.listProviders({ id: input.resource_id }, { take: 1 })
    if (!resource || resource.status !== "active") {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "This resource is not available.")
    }

    const {
      data: [variant],
    } = await query.graph({
      entity: "variant",
      fields: ["id", "product_id", "product.status", "calculated_price.*"],
      filters: { id: input.variant_id },
      context: {
        calculated_price: QueryContext({
          region_id: cart.region_id,
          currency_code: cart.currency_code,
        }),
      },
    })

    if (!variant || (variant as any).product?.status !== "published") {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Service not found.")
    }

    const [offering] = await service.listServiceProviders(
      { provider_id: resource.id, service_product_id: variant.product_id },
      { take: 1 }
    )
    if (!offering) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This resource does not offer that service."
      )
    }

    const basePrice = (variant as any).calculated_price?.calculated_amount
    if (typeof basePrice !== "number") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This service has no price in your currency."
      )
    }

    const currency = String(cart.currency_code)
    const rules = resource.vendor_id
      ? await service.listPricingRules(
          { vendor_id: resource.vendor_id, is_active: true },
          { take: null }
        )
      : []

    const priced = applyPricingRules(
      basePrice,
      rules.map((r) => ({ ...r, days_of_week: (r.days_of_week as unknown as number[] | null) ?? null })),
      {
        resource_id: resource.id,
        product_id: variant.product_id,
        start,
        timezone: resource.timezone,
        currency_code: currency,
      },
      ZERO_DECIMAL.has(currency.toLowerCase()) ? 0 : 2
    )

    return new StepResponse({
      customer_id: (cart.customer_id as string | null) ?? null,
      product_id: variant.product_id as string,
      resource_name: resource.display_name,
      resource_timezone: resource.timezone,
      hold_minutes: resource.hold_minutes,
      currency_code: currency,
      base_price: priced.base_price,
      // Only a pricing rule needs a custom price; otherwise Medusa prices the
      // variant itself, so tax handling stays exactly as configured.
      unit_price: priced.applied_rule_id ? priced.price : null,
      applied_rule_id: priced.applied_rule_id,
    })
  }
)
