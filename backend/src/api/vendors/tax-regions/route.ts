import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createTaxRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { getWorkflowPool } from "../workflow-executions/route"

export const GetVendorTaxRegionsSchema = z.object({
  q: z.string().optional(),
  order: z.string().optional(),
})

export const CreateVendorTaxRegionSchema = z.object({
  country_code: z.string().length(2),
  rate: z.coerce.number().min(0).max(100).optional(),
  name: z.string().optional(),
  code: z.string().optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { q, order } = (req.validatedQuery ?? {}) as z.infer<
    typeof GetVendorTaxRegionsSchema
  >

  const pool = getWorkflowPool()

  let whereClause = "WHERE tr.deleted_at IS NULL"
  const params: any[] = []

  if (q) {
    params.push(`%${q.toLowerCase()}%`)
    whereClause += ` AND (LOWER(tr.country_code) ILIKE $${params.length} OR LOWER(COALESCE(tra.name, '')) ILIKE $${params.length})`
  }

  let orderClause = "ORDER BY tr.country_code ASC"
  if (order) {
    const isDesc = order.startsWith("-")
    const field = isDesc ? order.slice(1) : order
    if (field === "country_code") {
      orderClause = `ORDER BY tr.country_code ${isDesc ? "DESC" : "ASC"}`
    } else if (field === "created_at") {
      orderClause = `ORDER BY tr.created_at ${isDesc ? "DESC" : "ASC"}`
    } else if (field === "rate") {
      orderClause = `ORDER BY tra.rate ${isDesc ? "DESC" : "ASC"}`
    }
  }

  const result = await pool.query(
    `SELECT tr.id, tr.country_code, tr.province_code, tr.provider_id, tr.created_at, tr.updated_at,
            tra.id as default_rate_id, tra.rate, tra.name as rate_name, tra.code as rate_code
     FROM tax_region tr
     LEFT JOIN tax_rate tra ON tra.tax_region_id = tr.id AND tra.deleted_at IS NULL AND (tra.is_default = true OR tra.is_default IS NULL)
     ${whereClause}
     ${orderClause}`,
    params
  )

  const taxRegions = result.rows.map((row) => ({
    id: row.id,
    country_code: row.country_code.toUpperCase(),
    province_code: row.province_code,
    provider_id: row.provider_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    rate: row.rate !== null && row.rate !== undefined ? `${row.rate}%` : "Default",
    raw_rate: row.rate,
    rate_name: row.rate_name || "Standard Tax",
    rate_code: row.rate_code || "TAX",
  }))

  res.json({ tax_regions: taxRegions })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorTaxRegionSchema>>,
  res: MedusaResponse
) => {
  const { country_code, rate, name, code } = req.validatedBody

  const { result } = await createTaxRegionsWorkflow(req.scope).run({
    input: [
      {
        country_code: country_code.toLowerCase(),
        default_tax_rate:
          rate !== undefined
            ? {
                rate,
                name: name || "Standard Rate",
                code: code || "TAX",
              }
            : undefined,
      },
    ],
  })

  res.status(201).json({ tax_region: result[0] })
}
