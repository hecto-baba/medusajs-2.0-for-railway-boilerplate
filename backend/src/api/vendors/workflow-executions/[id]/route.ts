import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getWorkflowPool } from "../route"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  // Resolve vendor and admin
  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor?.id) {
    res.status(404).json({ message: "Workflow execution not found" })
    return
  }

  const vendorId = vendorAdmin.vendor.id
  const vendorAdminId = vendorAdmin.id

  const pool = getWorkflowPool()

  try {
    const sql = `
      SELECT id, workflow_id, transaction_id, state, execution, context, created_at, updated_at
      FROM workflow_execution
      WHERE (id = $1 OR transaction_id = $1)
        AND deleted_at IS NULL
      LIMIT 1;
    `
    const dataRes = await pool.query(sql, [id])
    const row = dataRes.rows[0]

    if (!row) {
      res.status(404).json({ message: "Workflow execution not found" })
      return
    }

    // Enforce multi-tenant scoping
    const contextStr = typeof row.context === "object" ? JSON.stringify(row.context) : String(row.context || "")
    const executionStr = typeof row.execution === "object" ? JSON.stringify(row.execution) : String(row.execution || "")

    const isAuthorized =
      contextStr.includes(vendorAdminId) ||
      contextStr.includes(vendorId) ||
      executionStr.includes(vendorAdminId) ||
      executionStr.includes(vendorId)

    if (!isAuthorized) {
      res.status(404).json({ message: "Workflow execution not found" })
      return
    }

    res.json({ workflow_execution: row })
  } catch (err: any) {
    console.error("[VendorWorkflowExecutionDetail] Error:", err)
    res.status(500).json({ message: "Failed to load workflow execution" })
  }
}
