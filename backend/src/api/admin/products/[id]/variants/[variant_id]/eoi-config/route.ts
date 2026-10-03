import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { upsertEoiConfigWorkflow } from "../../../../../../../workflows/upsert-eoi-config"
import { MedusaError } from "@medusajs/framework/utils"
import { PostEoiConfigBodySchema, PostEoiConfigBody } from "./validators"

export { PostEoiConfigBodySchema }

/**
 * Confirms the variant id in the URL actually belongs to the product id in
 * the URL (fix #5 of docs/plan/EOI_VARIANT_LEVEL_FIX_EXECUTION_PLAN.md).
 * Admin is a trusted surface, so this guards against a URL-building bug
 * silently reading/writing the wrong variant's config, not primarily a
 * cross-tenant leak the way the equivalent vendor-side check is - but it
 * should still fail loudly (404) rather than operate on a mismatched pair.
 */
const assertVariantBelongsToProduct = async (
  req: AuthenticatedMedusaRequest,
  productId: string,
  variantId: string
): Promise<void> => {
  const query = req.scope.resolve("query")
  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id"],
    filters: { id: [variantId], product_id: [productId] },
  })

  if (!variants.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Variant not found.")
  }
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, variant_id } = req.params
  await assertVariantBelongsToProduct(req, id, variant_id)

  const query = req.scope.resolve("query")

  const { data: eoiConfigs } = await query.graph({
    entity: "eoi_configuration",
    // Explicit field list, not fields: ["*"] - querying-data.md's
    // Performance Best Practices names fields: ["*"] as the documented bad
    // example.
    fields: ["id", "variant_id", "value_type", "value_amount", "status"],
    filters: { variant_id },
  })

  res.json({ eoi_config: eoiConfigs[0] ?? null })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<PostEoiConfigBody>,
  res: MedusaResponse
) => {
  const { id, variant_id } = req.params
  await assertVariantBelongsToProduct(req, id, variant_id)

  try {
    const { result } = await upsertEoiConfigWorkflow(req.scope).run({
      input: {
        variant_id,
        ...req.validatedBody,
      },
    })

    res.json({ eoi_config: result })
  } catch (error) {
    if (error instanceof MedusaError) {
      throw error
    }
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Could not update EOI configuration for variant ${variant_id}: ${(error as Error).message}`
    )
  }
}
