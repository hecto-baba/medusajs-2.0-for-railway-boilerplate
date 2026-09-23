import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { Pool } from "pg"
import * as path from "path"
import * as fs from "fs"

export const GetVendorWorkflowExecutionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  workflow_id: z.string().optional(),
  state: z.string().optional(),
})

let dbPool: Pool | null = null

export function getWorkflowPool(): Pool {
  if (!dbPool) {
    let dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      try {
        const envPath = path.resolve(process.cwd(), ".env")
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, "utf-8")
          const match = content.match(/^DATABASE_URL=(.*)$/m)
          if (match && match[1]) {
            dbUrl = match[1].trim()
          }
        }
      } catch {}
    }
    dbPool = new Pool({
      connectionString: dbUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      ssl:
        dbUrl?.includes("sslmode=require") || process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    })
  }
  return dbPool
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, workflow_id, state } = (req.validatedQuery ??
    {}) as z.infer<typeof GetVendorWorkflowExecutionsSchema>

  // Resolve vendor and admin
  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "vendor.id", "vendor.handle"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor?.id) {
    res.json({
      workflow_executions: [],
      count: 0,
      offset,
      limit,
    })
    return
  }

  const vendorId = vendorAdmin.vendor.id
  const vendorAdminId = vendorAdmin.id

  const pool = getWorkflowPool()

  // Base parameters for vendor isolation
  const values: any[] = [`%${vendorAdminId}%`, `%${vendorId}%`]
  const conditions: string[] = [
    `deleted_at IS NULL`,
    `(context::text ILIKE $1 OR execution::text ILIKE $1 OR context::text ILIKE $2 OR execution::text ILIKE $2)`,
  ]

  let paramIndex = 3

  if (state && state !== "all") {
    conditions.push(`state = $${paramIndex++}`)
    values.push(state.toLowerCase())
  }

  if (workflow_id) {
    conditions.push(`workflow_id ILIKE $${paramIndex++}`)
    values.push(`%${workflow_id}%`)
  }

  if (q && q.trim()) {
    conditions.push(`(workflow_id ILIKE $${paramIndex} OR transaction_id ILIKE $${paramIndex})`)
    values.push(`%${q.trim()}%`)
    paramIndex++
  }

  const whereClause = conditions.join(" AND ")

  try {
    // Query total count
    const countSql = `SELECT COUNT(*) as total FROM workflow_execution WHERE ${whereClause};`
    const countRes = await pool.query(countSql, values)
    const count = parseInt(countRes.rows[0]?.total || "0", 10)

    // Query paginated executions
    const dataSql = `
      SELECT id, workflow_id, transaction_id, state, execution, context, created_at, updated_at
      FROM workflow_execution
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `
    const dataRes = await pool.query(dataSql, [...values, limit, offset])

    res.json({
      workflow_executions: dataRes.rows,
      count,
      offset,
      limit,
    })
  } catch (err: any) {
    console.error("[VendorWorkflowExecutions] Query error:", err)
    res.json({
      workflow_executions: [],
      count: 0,
      offset,
      limit,
    })
  }
}
