import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { deleteTaxRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { getWorkflowPool } from "../../workflow-executions/route"

export const UpdateVendorTaxRateSchema = z.object({
  rate: z.coerce.number().min(0).max(100),
  name: z.string().optional(),
  code: z.string().optional(),
})

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    await deleteTaxRegionsWorkflow(req.scope).run({
      input: { ids: [id] },
    })
    res.json({ id, object: "tax_region", deleted: true })
  } catch (error: any) {
    // Fallback direct soft delete in case workflow encounters cascade issue
    const pool = getWorkflowPool()
    await pool.query(
      `UPDATE tax_region SET deleted_at = NOW() WHERE id = $1`,
      [id]
    )
    res.json({ id, object: "tax_region", deleted: true })
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorTaxRateSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { rate, name, code } = req.validatedBody

  const pool = getWorkflowPool()

  // Check if default tax rate already exists for this tax region
  const existingRate = await pool.query(
    `SELECT id FROM tax_rate WHERE tax_region_id = $1 AND deleted_at IS NULL AND (is_default = true OR is_default IS NULL) LIMIT 1`,
    [id]
  )

  let rateId: string
  if (existingRate.rows.length > 0) {
    rateId = existingRate.rows[0].id
    await pool.query(
      `UPDATE tax_rate
       SET rate = $1, name = COALESCE($2, name), code = COALESCE($3, code), updated_at = NOW()
       WHERE id = $4`,
      [rate, name || null, code || null, rateId]
    )
  } else {
    rateId = `txrate_${Date.now()}`
    await pool.query(
      `INSERT INTO tax_rate (id, rate, name, code, is_default, is_combinable, tax_region_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, false, $5, NOW(), NOW())`,
      [rateId, rate, name || "Standard Rate", code || "TAX", id]
    )
  }

  res.json({
    tax_region_id: id,
    rate_id: rateId,
    rate,
    name: name || "Standard Rate",
    code: code || "TAX",
  })
}
