import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import { resolveVendorAdmin } from "../shared/vendor-scope"

export const GetVendorTeamSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  order: z.string().optional(),
  created_at_gte: z.string().optional(),
  updated_at_gte: z.string().optional(),
})

export const InviteVendorMemberSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, order, created_at_gte, updated_at_gte } =
    req.validatedQuery as unknown as z.infer<typeof GetVendorTeamSchema>

  // Get vendor id of current user
  const currentAdmin = await resolveVendorAdmin(req, ["vendor.id"])

  const vendorId = currentAdmin?.vendor?.id

  if (!vendorId) {
    res.status(404).json({ message: "Vendor not found." })
    return
  }

  let orderObj: Record<string, "ASC" | "DESC"> = { created_at: "ASC" }
  if (order) {
    const isDesc = order.startsWith("-")
    const rawField = isDesc ? order.slice(1) : order
    const field = rawField === "name" ? "first_name" : rawField
    orderObj = { [field]: isDesc ? "DESC" : "ASC" }
  }

  const { data: members, metadata } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "created_at",
      "updated_at",
    ],
    filters: {
      vendor: { id: [vendorId] },
      ...(created_at_gte ? { created_at: { $gte: new Date(created_at_gte) } } : {}),
      ...(updated_at_gte ? { updated_at: { $gte: new Date(updated_at_gte) } } : {}),
      ...(q
        ? {
            $or: [
              { email: { $ilike: `%${q}%` } },
              { first_name: { $ilike: `%${q}%` } },
              { last_name: { $ilike: `%${q}%` } },
            ],
          }
        : {}),
    },
    pagination: {
      skip: offset,
      take: limit,
      order: orderObj,
    },
  })

  res.json({
    members,
    count: metadata?.count ?? members.length,
    limit,
    offset,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof InviteVendorMemberSchema>>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const marketplaceService = req.scope.resolve(MARKETPLACE_MODULE)
  const { email, first_name, last_name } = req.validatedBody

  const currentAdmin = await resolveVendorAdmin(req, ["vendor.id"])

  const vendorId = currentAdmin?.vendor?.id

  if (!vendorId) {
    res.status(404).json({ message: "Vendor profile not found." })
    return
  }

  // Create new vendor admin member
  const newMember = await (marketplaceService as any).createVendorAdmins({
    email,
    first_name: first_name || null,
    last_name: last_name || null,
    vendor_id: vendorId,
  })

  res.status(201).json({ member: newMember })
}
