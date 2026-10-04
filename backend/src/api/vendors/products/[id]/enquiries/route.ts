import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { assertOwnership } from "../../helpers"

const MAX_PER_PRODUCT = 200

/**
 * Enquiries for one of the vendor's products - the query the sellers-panel
 * product page uses. assertOwnership first: the caller being *a* vendor says
 * nothing about this product being theirs.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: enquiries } = await query.graph({
    entity: "enquiry",
    fields: [
      "id",
      "product_id",
      "customer_id",
      "customer_email",
      "message",
      "custom_field_answers",
      "custom_fields_snapshot",
      "reply",
      "status",
      "responded_at",
      "created_at",
      "updated_at",
    ],
    filters: { product_id: id },
    // Newest first, ordered by the database and capped: a popular product can
    // collect many enquiries and this is read on every product-page load.
    pagination: { take: MAX_PER_PRODUCT, order: { created_at: "DESC" } },
  })

  res.json({ enquiries, count: enquiries.length })
}
