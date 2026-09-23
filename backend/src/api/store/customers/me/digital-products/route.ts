import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  if (!req.auth_context?.actor_id) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [customer] } = await query.graph({
    entity: "customer",
    fields: [
      "orders.digital_product_order.products.*",
      "orders.digital_product_order.products.medias.*",
    ],
    filters: {
      id: req.auth_context.actor_id,
    },
  })

  const digitalProducts: Record<string, any> = {}

  customer?.orders?.forEach((order: any) => {
    order?.digital_product_order?.products?.forEach((product: any) => {
      if (!product) {
        return
      }

      digitalProducts[product.id] = product
    })
  })

  res.json({
    digital_products: Object.values(digitalProducts),
  })
}
