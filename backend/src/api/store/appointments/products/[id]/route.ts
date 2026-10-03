import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { computeReadiness } from "../../../../vendors/resources/helpers"
import { getService, isVendorApproved } from "../../helpers"

export const GetProductOfferSchema = z.object({
  region_id: z.string().optional(),
  currency_code: z.string().trim().length(3).optional(),
})

/**
 * "Not bookable" has two meanings the product page must tell apart:
 * is_appointment false = an ordinary product, show the normal Add to cart;
 * is_appointment true  = a service nobody can be booked for right now, which must
 *                        NOT fall back to Add to cart (it would be bought as a
 *                        plain item with no person and no time).
 */
const NOT_AN_APPOINTMENT = {
  bookable: false,
  is_appointment: false,
  business: null,
  service: null,
  resources: [],
}
const NOT_BOOKABLE_NOW = { ...NOT_AN_APPOINTMENT, is_appointment: true }

/**
 * Is this product an appointment buyers can book right now, and with whom?
 *
 * A product page calls this to decide between the normal "Add to cart" and the
 * booking panel. It answers "not bookable" (never an error) for a product that
 * nobody offers, is not published, or whose resources are not live yet, so the
 * page simply falls back to the normal flow.
 *
 * Only live resources are returned: active, with weekly hours, belonging to an
 * approved seller. The price is the starting price in the buyer's region.
 * Queries: the offerings, the resources, readiness, the product and the vendor,
 * each once for all resources.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = getService(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const pricing = req.validatedQuery as z.infer<typeof GetProductOfferSchema>
  const productId = req.params.id

  const offerings = await service.listServiceProviders(
    { service_product_id: productId },
    { take: null }
  )
  if (!offerings.length) {
    res.json(NOT_AN_APPOINTMENT)
    return
  }

  const resources = await service.listProviders(
    { id: offerings.map((o) => o.provider_id), status: "active" },
    { take: null, order: { created_at: "ASC" } }
  )

  // A seller whose setup is not approved is invisible to buyers. Each lookup is
  // a database round trip, so readiness and every vendor check run together.
  const vendorIds = [...new Set(resources.map((r) => r.vendor_id).filter(Boolean))] as string[]
  const [readiness, approvals] = await Promise.all([
    computeReadiness(service, resources),
    Promise.all(vendorIds.map((vendorId) => isVendorApproved(req, vendorId))),
  ])
  const approvedVendors = new Set<string>(vendorIds.filter((_, i) => approvals[i]))

  const live = resources.filter(
    (r) => readiness.get(r.id)?.live && r.vendor_id && approvedVendors.has(r.vendor_id)
  )
  if (!live.length) {
    res.json(NOT_BOOKABLE_NOW)
    return
  }

  // Pricing needs a currency. A region_id alone is not enough for the pricing
  // module (it throws), so take the region's currency when none was given.
  let currencyCode = pricing.currency_code
  if (!currencyCode && pricing.region_id) {
    const {
      data: [region],
    } = await query.graph({
      entity: "region",
      fields: ["id", "currency_code"],
      filters: { id: [pricing.region_id] },
    })
    currencyCode = (region as any)?.currency_code
  }

  // The vendor lookup does not depend on the product, so start it now.
  const vendorPromise = query.graph({
    entity: "vendor",
    fields: ["id", "handle", "name", "logo"],
    filters: { id: [live[0].vendor_id as string] },
  })
  // If the product turns out to be missing we return early and never await this.
  vendorPromise.catch(() => {})

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "description",
      "thumbnail",
      "status",
      "variants.id",
      "variants.title",
      "variants.calculated_price.*",
    ],
    filters: { id: [productId], status: "published" },
    context: {
      variants: {
        calculated_price: QueryContext({
          region_id: pricing.region_id,
          currency_code: currencyCode,
        }),
      },
    },
  })
  if (!product) {
    // Unpublished or missing: the product page would not be shown, so this is
    // only reached for a draft; treat it as an appointment that cannot be booked.
    res.json(NOT_BOOKABLE_NOW)
    return
  }

  const {
    data: [vendor],
  } = await vendorPromise

  const offeringByResource = new Map(offerings.map((o) => [o.provider_id, o]))
  const variants = ((product as any).variants ?? []) as any[]
  const prices = variants
    .map((v) => v.calculated_price?.calculated_amount)
    .filter((n: unknown): n is number => typeof n === "number")

  res.json({
    bookable: true,
    is_appointment: true,
    business: vendor ?? null,
    service: {
      product_id: (product as any).id,
      title: (product as any).title,
      description: (product as any).description ?? null,
      thumbnail: (product as any).thumbnail ?? null,
      from_price: prices.length ? Math.min(...prices) : null,
      currency_code:
        variants[0]?.calculated_price?.currency_code ?? currencyCode ?? null,
      variants: variants.map((v) => ({
        id: v.id,
        title: v.title,
        price: v.calculated_price?.calculated_amount ?? null,
      })),
    },
    resources: live.map((r) => {
      const offering = offeringByResource.get(r.id)
      return {
        id: r.id,
        name: r.display_name,
        description: r.description ?? r.bio ?? null,
        image_url: r.image_url ?? null,
        kind: r.kind,
        timezone: r.timezone,
        duration_minutes: offering?.duration_minutes ?? r.session_duration_minutes,
        capacity: offering?.capacity ?? r.capacity,
      }
    }),
  })
}
