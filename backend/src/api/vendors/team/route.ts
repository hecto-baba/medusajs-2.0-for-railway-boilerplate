import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"

export const GetVendorTeamSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
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
  const { limit, offset, q } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorTeamSchema
  >

  // Get vendor id of current user
  const {
    data: [currentAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorId = currentAdmin?.vendor?.id

  if (!vendorId) {
    res.status(404).json({ message: "Vendor not found." })
    return
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
      order: { created_at: "ASC" },
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

  const {
    data: [currentAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

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
