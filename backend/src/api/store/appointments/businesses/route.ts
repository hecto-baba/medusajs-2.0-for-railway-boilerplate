import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { computeReadiness } from "../../../vendors/resources/helpers"
import { getApprovedVendorIds, getService } from "../helpers"

export const GetBusinessesSchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Businesses a buyer can book with: approved vendors that have at least one
 * resource that is live (active, has weekly hours, offers a service).
 *
 * Fixed number of queries regardless of how many businesses exist: approved
 * vendor ids, their active resources, readiness for all of them at once, and
 * one vendor lookup for the businesses that qualify.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = getService(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { q, limit, offset } = req.validatedQuery as z.infer<typeof GetBusinessesSchema>

  const approved = await getApprovedVendorIds(req)
  if (!approved.size) {
    res.json({ businesses: [], count: 0, limit, offset })
    return
  }

  const resources = await service.listProviders(
    { status: "active", vendor_id: [...approved] },
    { select: ["id", "vendor_id", "status"], take: null }
  )

  const readiness = await computeReadiness(service, resources)
  const liveByVendor = new Map<string, number>()
  for (const r of resources) {
    if (readiness.get(r.id)?.live && r.vendor_id) {
      liveByVendor.set(r.vendor_id, (liveByVendor.get(r.vendor_id) ?? 0) + 1)
    }
  }

  if (!liveByVendor.size) {
    res.json({ businesses: [], count: 0, limit, offset })
    return
  }

  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: ["id", "handle", "name", "logo"],
    filters: { id: [...liveByVendor.keys()] },
  })

  const needle = q?.toLowerCase()
  const matching = (vendors as any[])
    .filter((v) => !needle || String(v.name).toLowerCase().includes(needle))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))

  res.json({
    businesses: matching.slice(offset, offset + limit).map((v) => ({
      id: v.id,
      handle: v.handle,
      name: v.name,
      logo: v.logo ?? null,
      resource_count: liveByVendor.get(v.id) ?? 0,
    })),
    count: matching.length,
    limit,
    offset,
  })
}
