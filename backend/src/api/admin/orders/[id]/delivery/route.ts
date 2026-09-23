import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "delivery.*",
        "delivery.driver.*",
        "delivery.restaurant.*",
      ],
      filters: {
        id,
      },
    })
    return res.json({ delivery: order?.delivery || null })
  } catch (e) {
    return res.json({ delivery: null })
  }
}
