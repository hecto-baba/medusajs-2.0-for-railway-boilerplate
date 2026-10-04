import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  QueryContext,
} from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { computeReadiness } from "../../../../vendors/resources/helpers"
import { getService, isVendorApproved } from "../../helpers"

export const GetBusinessSchema = z.object({
  region_id: z.string().optional(),
  currency_code: z.string().trim().length(3).optional(),
})

/**
 * One business: its live resources and, for each, the services it offers with
 * their prices (the starting price per service, in the buyer's currency).
 *
 * Queries: the vendor, its resources, readiness for all of them, every offering
 * of those resources in one query, and every offered product - with variants and
 * prices - in one query. Nothing is looked up per resource.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = getService(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const pricing = req.validatedQuery as z.infer<typeof GetBusinessSchema>
  const notFound = new MedusaError(MedusaError.Types.NOT_FOUND, "Business not found.")

  const {
    data: [vendor],
  } = await query.graph({
    entity: "vendor",
    fields: ["id", "handle", "name", "logo"],
    filters: { handle: req.params.handle },
  })
  if (!vendor) throw notFound

  if (!(await isVendorApproved(req, vendor.id))) throw notFound

  const allResources = await service.listProviders(
    { vendor_id: vendor.id, status: "active" },
    { take: null, order: { created_at: "ASC" } }
  )
  const readiness = await computeReadiness(service, allResources)
  const resources = allResources.filter((r) => readiness.get(r.id)?.live)

  if (!resources.length) {
    res.json({ business: vendor, resources: [] })
    return
  }

  const offerings = await service.listServiceProviders(
    { provider_id: resources.map((r) => r.id) },
    { take: null }
  )
  const productIds = [...new Set(offerings.map((o) => o.service_product_id))]

  const productById = new Map<string, any>()
  if (productIds.length) {
    const { data: products } = await query.graph({
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
      filters: { id: productIds, status: "published" },
      context: {
        variants: {
          calculated_price: QueryContext({
            region_id: pricing.region_id,
            currency_code: pricing.currency_code,
          }),
        },
      },
    })
    for (const p of products as any[]) productById.set(p.id, p)
  }

  const offeringsByResource = new Map<string, typeof offerings>()
  for (const o of offerings) {
    const list = offeringsByResource.get(o.provider_id) ?? []
    list.push(o)
    offeringsByResource.set(o.provider_id, list)
  }

  res.json({
    business: vendor,
    resources: resources.map((r) => ({
      id: r.id,
      name: r.display_name,
      description: r.description ?? r.bio ?? null,
      image_url: r.image_url ?? null,
      kind: r.kind,
      timezone: r.timezone,
      services: (offeringsByResource.get(r.id) ?? []).flatMap((o) => {
        const product = productById.get(o.service_product_id)
        if (!product) return []
        const prices = (product.variants ?? [])
          .map((v: any) => v.calculated_price?.calculated_amount)
          .filter((n: unknown): n is number => typeof n === "number")
        return [
          {
            product_id: product.id,
            title: product.title,
            description: product.description ?? null,
            thumbnail: product.thumbnail ?? null,
            duration_minutes: o.duration_minutes ?? r.session_duration_minutes,
            capacity: o.capacity ?? r.capacity,
            from_price: prices.length ? Math.min(...prices) : null,
            currency_code:
              product.variants?.[0]?.calculated_price?.currency_code ?? pricing.currency_code ?? null,
            variants: (product.variants ?? []).map((v: any) => ({
              id: v.id,
              title: v.title,
              price: v.calculated_price?.calculated_amount ?? null,
            })),
          },
        ]
      }),
    })),
  })
}
