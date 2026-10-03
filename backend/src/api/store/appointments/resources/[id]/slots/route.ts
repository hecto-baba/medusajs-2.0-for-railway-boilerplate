import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MAX_RANGE_DAYS } from "../../../../../../modules/appointment-booking/lib/availability"
import { applyPricingRules } from "../../../../../../modules/appointment-booking/lib/pricing"
import { getService, loadPublicResource, loadVariantPrice } from "../../../helpers"

export const GetResourceSlotsSchema = z
  .object({
    product_id: z.string().min(1),
    variant_id: z.string().optional(),
    from: z.coerce.date(),
    to: z.coerce.date(),
    region_id: z.string().optional(),
    currency_code: z.string().trim().length(3).optional(),
  })
  .refine((v) => !!v.region_id || !!v.currency_code, {
    message: "region_id or currency_code is required",
  })

const ZERO_DECIMAL = new Set(["jpy", "krw", "vnd", "clp", "pyg", "ugx", "xaf", "xof", "xpf", "bif", "djf", "gnf", "kmf", "rwf", "vuv"])

/**
 * Open slots for one resource and service, with the final price of each.
 *
 * Public and read-only. Computed live from the resource's weekly hours,
 * holidays, session length, buffers, notice window and existing bookings - the
 * same engine the booking itself re-validates against, so what is shown is what
 * can actually be booked. The price shown is what will be charged: it is
 * computed here with the same function the booking uses.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = getService(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const q = req.validatedQuery as z.infer<typeof GetResourceSlotsSchema>

  if (q.to.getTime() - q.from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Choose a range of at most ${MAX_RANGE_DAYS} days.`
    )
  }

  const resource = await loadPublicResource(req, service, req.params.id)

  const [offering] = await service.listServiceProviders(
    { provider_id: resource.id, service_product_id: q.product_id },
    { take: 1 }
  )
  if (!offering) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Service not found.")
  }

  // Variant: the one asked for, else the product's first.
  let variantId = q.variant_id
  if (!variantId) {
    const {
      data: [product],
    } = await query.graph({
      entity: "product",
      fields: ["id", "variants.id"],
      filters: { id: q.product_id, status: "published" },
    })
    variantId = (product as any)?.variants?.[0]?.id
    if (!variantId) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Service not found.")
    }
  }

  const variant = await loadVariantPrice(req, variantId, {
    region_id: q.region_id,
    currency_code: q.currency_code,
  })
  if (variant.product_id !== q.product_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Service not found.")
  }

  const [slots, rules] = await Promise.all([
    service.listBookableSlots({
      provider_id: resource.id,
      product_id: q.product_id,
      from: q.from,
      to: q.to,
    }),
    service.listPricingRules(
      { vendor_id: resource.vendor_id, is_active: true },
      { take: null }
    ),
  ])

  const currency = variant.currency_code ?? q.currency_code ?? ""
  const decimals = ZERO_DECIMAL.has(currency.toLowerCase()) ? 0 : 2
  const normalizedRules = rules.map((r) => ({
    ...r,
    days_of_week: (r.days_of_week as unknown as number[] | null) ?? null,
  }))

  res.json({
    resource: {
      id: resource.id,
      name: resource.display_name,
      timezone: resource.timezone,
      hold_minutes: resource.hold_minutes,
      cancellation_window_hours: resource.cancellation_window_hours,
    },
    variant_id: variant.variant_id,
    currency_code: currency || null,
    count: slots.length,
    slots: slots.map((s) => {
      const price =
        variant.base_price === null
          ? null
          : applyPricingRules(
              variant.base_price,
              normalizedRules,
              {
                resource_id: resource.id,
                product_id: q.product_id,
                start: s.start,
                timezone: resource.timezone,
                currency_code: currency,
              },
              decimals
            ).price
      return {
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        capacity: s.capacity,
        spots_left: s.capacity_remaining,
        price,
      }
    }),
  })
}
