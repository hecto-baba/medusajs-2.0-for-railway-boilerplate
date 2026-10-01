import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createShippingProfilesWorkflow } from "@medusajs/medusa/core-flows"

export const CreateVendorShippingProfileSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("default"),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GetVendorShippingProfilesSchema = z.object({
  q: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  created_at_gte: z.string().optional(),
  updated_at_gte: z.string().optional(),
  order: z.string().optional(),
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const qParams = (req.validatedQuery || req.query || {}) as Record<string, any>
  const qSearch = typeof qParams.q === "string" ? qParams.q.trim().toLowerCase() : undefined
  const nameFilter = typeof qParams.name === "string" ? qParams.name.trim().toLowerCase() : undefined
  const typeFilter = typeof qParams.type === "string" ? qParams.type.trim().toLowerCase() : undefined
  const createdAtGte = typeof qParams.created_at_gte === "string" ? qParams.created_at_gte : undefined
  const updatedAtGte = typeof qParams.updated_at_gte === "string" ? qParams.updated_at_gte : undefined
  const order = typeof qParams.order === "string" ? qParams.order : undefined
  const limit = typeof qParams.limit !== "undefined" ? Number(qParams.limit) : 20
  const offset = typeof qParams.offset !== "undefined" ? Number(qParams.offset) : 0

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type", "metadata", "created_at", "updated_at"],
  })

  let filtered = (shippingProfiles || []) as any[]

  if (qSearch) {
    filtered = filtered.filter(
      (sp) =>
        (sp.name && sp.name.toLowerCase().includes(qSearch)) ||
        (sp.type && sp.type.toLowerCase().includes(qSearch))
    )
  }

  if (nameFilter) {
    filtered = filtered.filter(
      (sp) => sp.name && sp.name.toLowerCase().includes(nameFilter)
    )
  }

  if (typeFilter) {
    filtered = filtered.filter(
      (sp) => sp.type && sp.type.toLowerCase() === typeFilter
    )
  }

  if (createdAtGte) {
    const minDate = new Date(createdAtGte).getTime()
    filtered = filtered.filter(
      (sp) => sp.created_at && new Date(sp.created_at).getTime() >= minDate
    )
  }

  if (updatedAtGte) {
    const minDate = new Date(updatedAtGte).getTime()
    filtered = filtered.filter(
      (sp) => sp.updated_at && new Date(sp.updated_at).getTime() >= minDate
    )
  }

  if (order) {
    const isDesc = order.startsWith("-")
    const field = isDesc ? order.slice(1) : order
    filtered.sort((a, b) => {
      let valA = a[field] ?? ""
      let valB = b[field] ?? ""
      if (field === "created_at" || field === "updated_at") {
        valA = valA ? new Date(valA).getTime() : 0
        valB = valB ? new Date(valB).getTime() : 0
      } else if (typeof valA === "string") {
        valA = valA.toLowerCase()
        valB = typeof valB === "string" ? valB.toLowerCase() : ""
      }
      if (valA < valB) return isDesc ? 1 : -1
      if (valA > valB) return isDesc ? -1 : 1
      return 0
    })
  } else {
    filtered.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
      return timeB - timeA
    })
  }

  const count = filtered.length
  const paginated = limit > 0 ? filtered.slice(offset, offset + limit) : filtered

  res.json({
    shipping_profiles: paginated,
    count,
    limit,
    offset,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorShippingProfileSchema>>,
  res: MedusaResponse
) => {
  const { result } = await createShippingProfilesWorkflow(req.scope).run({
    input: {
      data: [req.validatedBody as any],
    },
  })

  res.status(201).json({ shipping_profile: result[0] })
}
