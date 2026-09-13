import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { assertOwnership } from "../../helpers"

/**
 * Lists the option definitions of one of the vendor's products.
 *
 * Options are what the variant grid is generated from ("Size" -> S/M/L), so
 * the panel reads them before it can offer variant creation.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: options } = await query.graph({
    entity: "product_option",
    fields: ["id", "title", "metadata", "values.id", "values.value"],
    // Filtered by the product relation rather than a product_id column:
    // options join to products through a link, so there is no scalar
    // product_id to match on. This mirrors the admin route.
    filters: { products: { id } },
  })

  res.json({ product_options: options, count: options.length })
}
