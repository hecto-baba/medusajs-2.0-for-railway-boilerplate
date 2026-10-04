import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { upsertEoiConfigWorkflow } from "../../../../../../../workflows/upsert-eoi-config"
import { assertOwnership, assertVariantBelongsToProduct } from "../../../../helpers"
import { PostEoiConfigBodySchema, PostEoiConfigBody } from "../../../../../../admin/products/[id]/variants/[variant_id]/eoi-config/validators"

/**
 * Expression of Interest settings for one of the vendor's own product
 * variants. Mirrors vendors/products/[id]/variants/.../rental-config/route.ts's
 * shape (if one exists) and the admin's identical pair of handlers under
 * /admin/products/:id/variants/:variant_id, but that route takes both ids
 * straight from the URL with no owner check.
 *
 * Two checks run before any read or write, not one:
 * - assertOwnership confirms the product id in the URL belongs to this vendor.
 * - assertVariantBelongsToProduct confirms the variant id in the URL actually
 *   belongs to THAT product - without this, a vendor could pair their own
 *   product id with another vendor's variant id and read/write that variant's
 *   EOI config, since assertOwnership alone only checks the product half of
 *   the URL (see docs/plan/EOI_VARIANT_LEVEL_CONFIG_PLAN.md Phase 6.1 and
 *   sellers/PRODUCTS.md §6 rule 2, which this introduces for the first time
 *   on this route now that it carries a second caller-supplied id).
 *
 * The EOI configuration itself carries no vendor field; it hangs off the
 * variant through a module link, so product+variant ownership is what
 * decides access here. The Zod schema is imported from the admin route's
 * validators file (not redeclared) so the two panels cannot drift on
 * request shape.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, variant_id } = req.params
  await assertOwnership(req, id)
  await assertVariantBelongsToProduct(req, id, variant_id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: eoiConfigs } = await query.graph({
    entity: "eoi_configuration",
    fields: ["id", "variant_id", "value_type", "value_amount", "status"],
    filters: { variant_id },
  })

  // null rather than 404 when there is none: "this variant is not EOI-eligible"
  // is a normal state the panel renders, not an error.
  res.json({ eoi_config: eoiConfigs[0] ?? null })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<PostEoiConfigBody>,
  res: MedusaResponse
) => {
  const { id, variant_id } = req.params
  await assertOwnership(req, id)
  await assertVariantBelongsToProduct(req, id, variant_id)

  const { result } = await upsertEoiConfigWorkflow(req.scope).run({
    input: {
      variant_id,
      ...req.validatedBody,
    },
  })

  res.json({ eoi_config: result })
}

export { PostEoiConfigBodySchema }
