import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../../modules/marketplace"

export const UpdateVendorMemberSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const memberId = req.params.id

  const { data: members } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "created_at",
      "updated_at",
      "vendor.id",
      "vendor.name",
    ],
    filters: { id: memberId },
  })

  if (!members?.length) {
    res.status(404).json({ message: "Team member not found." })
    return
  }

  res.json({ member: members[0] })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorMemberSchema>>,
  res: MedusaResponse
) => {
  const marketplaceService = req.scope.resolve(MARKETPLACE_MODULE)
  const memberId = req.params.id

  const updatedMember = await (marketplaceService as any).updateVendorAdmins({
    id: memberId,
    ...req.validatedBody,
  })

  res.json({ member: updatedMember })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const marketplaceService = req.scope.resolve(MARKETPLACE_MODULE)
  const memberId = req.params.id

  if (memberId === req.auth_context.actor_id) {
    res.status(400).json({ message: "You cannot remove your own account from the team." })
    return
  }

  await (marketplaceService as any).deleteVendorAdmins([memberId])

  res.json({ id: memberId, object: "vendor_admin", deleted: true })
}
