import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { upsertEoiConfigWorkflow } from "../../../../../workflows/upsert-eoi-config"
import { MedusaError } from "@medusajs/framework/utils"
import { PostEoiConfigBodySchema, PostEoiConfigBody } from "./validators"

export { PostEoiConfigBodySchema }

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const query = req.scope.resolve("query")

  const { data: eoiConfigs } = await query.graph({
    entity: "eoi_configuration",
    // Explicit field list, not fields: ["*"] - querying-data.md's
    // Performance Best Practices names fields: ["*"] as the documented bad
    // example.
    fields: ["id", "product_id", "value_type", "value_amount", "status"],
    filters: { product_id: id },
  })

  res.json({ eoi_config: eoiConfigs[0] ?? null })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<PostEoiConfigBody>,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const { result } = await upsertEoiConfigWorkflow(req.scope).run({
      input: {
        product_id: id,
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
      `Could not update EOI configuration for product ${id}: ${(error as Error).message}`
    )
  }
}
