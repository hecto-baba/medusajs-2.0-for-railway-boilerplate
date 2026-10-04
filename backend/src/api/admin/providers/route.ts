import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { isUniqueViolation } from "../../../modules/appointment-booking/lib/db-errors"
import { computeReadiness } from "../../vendors/resources/helpers"
import { PostResourceSchema } from "../../vendors/resources/schemas"
import { getService, vendorsById } from "./helpers"

export const PostAdminResourceSchema = PostResourceSchema.extend({
  vendor_id: z.string().min(1),
})

/**
 * Resources across every vendor, with the owning business and whether each is
 * ready to take bookings. Search matches the resource name OR the business name.
 * Queries are fixed in number (vendor match, page of resources with count,
 * vendors for the page, readiness for the page).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = getService(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit = "15", offset = "0", q, vendor_id } = req.query as Record<string, string>

  const take = Math.min(200, Math.max(1, parseInt(limit, 10) || 15))
  const skip = Math.max(0, parseInt(offset, 10) || 0)
  const needle = typeof q === "string" ? q.trim() : ""

  const filters: Record<string, any> = {}
  if (vendor_id) filters.vendor_id = vendor_id

  if (needle) {
    const { data: matchingVendors } = await query.graph({
      entity: "vendor",
      fields: ["id"],
      filters: { name: { $ilike: `%${needle}%` } },
    })
    const or: Record<string, any>[] = [{ display_name: { $ilike: `%${needle}%` } }]
    if (matchingVendors.length) {
      or.push({ vendor_id: (matchingVendors as any[]).map((v) => v.id) })
    }
    filters.$or = or
  }

  const [providers, count] = await service.listAndCountProviders(filters, {
    take,
    skip,
    order: { created_at: "DESC" },
  })

  const [vendors, readiness, { data: admins }] = await Promise.all([
    vendorsById(req, providers.map((p) => p.vendor_id)),
    computeReadiness(service, providers),
    // Legacy: the staff login behind profiles created before multi-resource.
    providers.length
      ? query.graph({
          entity: "provider",
          fields: ["id", "vendor_admin.email", "vendor_admin.first_name", "vendor_admin.last_name"],
          filters: { id: providers.map((p) => p.id) },
        })
      : Promise.resolve({ data: [] as any[] }),
  ])
  const adminById = new Map((admins as any[]).map((a) => [a.id, a.vendor_admin ?? null]))

  res.json({
    providers: providers.map((p) => ({
      ...p,
      vendor: p.vendor_id ? vendors.get(p.vendor_id) ?? null : null,
      vendor_admin: adminById.get(p.id) ?? null,
      readiness: readiness.get(p.id),
    })),
    count,
    limit: take,
    offset: skip,
  })
}

/** Creates a resource on a vendor's behalf. */
export const POST = async (
  req: MedusaRequest<z.infer<typeof PostAdminResourceSchema>>,
  res: MedusaResponse
) => {
  const service = getService(req)
  const { vendor_id, ...rest } = req.validatedBody

  const vendors = await vendorsById(req, [vendor_id])
  if (!vendors.has(vendor_id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Vendor not found.")
  }

  const body = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  ) as Omit<z.infer<typeof PostAdminResourceSchema>, "vendor_id">

  try {
    const resource = await service.createProviders({ ...body, vendor_id })
    res.status(201).json({ resource })
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "This business already has a resource with that name."
      )
    }
    throw err
  }
}
