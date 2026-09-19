import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: appointments } = await query.graph({
    entity: "appointment",
    fields: [
      "id",
      "start_time",
      "end_time",
      "max_capacity",
      "status",
      "service_product.*",
      "attendees.*",
    ],
    filters: { provider_id: id },
  })

  res.json({ appointments })
}
