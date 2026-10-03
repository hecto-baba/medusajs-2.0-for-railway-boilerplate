import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [provider],
  } = await query.graph({
    entity: "provider",
    fields: [
      "id",
      "display_name",
      "bio",
      "timezone",
      "status",
      "vendor_admin.email",
      "vendor_admin.first_name",
      "vendor_admin.last_name",
    ],
    filters: { id },
  })

  res.json({ provider: provider ?? null })
}
