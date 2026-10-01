import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createShippingOptionTypesWorkflow } from "@medusajs/medusa/core-flows"

export const CreateVendorShippingOptionTypeSchema = z.object({
  label: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
})

export const GetVendorShippingOptionTypesSchema = z.object({
  q: z.string().optional(),
  label: z.string().optional(),
  code: z.string().optional(),
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
  const labelFilter = typeof qParams.label === "string" ? qParams.label.trim().toLowerCase() : undefined
  const codeFilter = typeof qParams.code === "string" ? qParams.code.trim().toLowerCase() : undefined
  const createdAtGte = typeof qParams.created_at_gte === "string" ? qParams.created_at_gte : undefined
  const updatedAtGte = typeof qParams.updated_at_gte === "string" ? qParams.updated_at_gte : undefined
  const order = typeof qParams.order === "string" ? qParams.order : undefined
  const limit = typeof qParams.limit !== "undefined" ? Number(qParams.limit) : 20
  const offset = typeof qParams.offset !== "undefined" ? Number(qParams.offset) : 0

  const { data: optionTypes } = await query.graph({
    entity: "shipping_option_type",
    fields: ["id", "label", "code", "description", "created_at", "updated_at"],
  })

  let filtered = (optionTypes || []) as any[]

  if (qSearch) {
    filtered = filtered.filter(
      (ot) =>
        (ot.label && ot.label.toLowerCase().includes(qSearch)) ||
        (ot.code && ot.code.toLowerCase().includes(qSearch)) ||
        (ot.description && ot.description.toLowerCase().includes(qSearch))
    )
  }

  if (labelFilter) {
    filtered = filtered.filter(
      (ot) => ot.label && ot.label.toLowerCase().includes(labelFilter)
    )
  }

  if (codeFilter) {
    filtered = filtered.filter(
      (ot) => ot.code && ot.code.toLowerCase().includes(codeFilter)
    )
  }

  if (createdAtGte) {
    const minDate = new Date(createdAtGte).getTime()
    filtered = filtered.filter(
      (ot) => ot.created_at && new Date(ot.created_at).getTime() >= minDate
    )
  }

  if (updatedAtGte) {
    const minDate = new Date(updatedAtGte).getTime()
    filtered = filtered.filter(
      (ot) => ot.updated_at && new Date(ot.updated_at).getTime() >= minDate
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
    shipping_option_types: paginated,
    count,
    limit,
    offset,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorShippingOptionTypeSchema>>,
  res: MedusaResponse
) => {
  const { result } = await (createShippingOptionTypesWorkflow(req.scope) as any).run({
    input: {
      shipping_option_types: [req.validatedBody as any],
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: optionTypes } = await query.graph({
    entity: "shipping_option_type",
    fields: ["id", "label", "code", "description", "created_at", "updated_at"],
    filters: { id: result[0].id },
  })

  res.status(201).json({ shipping_option_type: optionTypes?.[0] || result[0] })
}
