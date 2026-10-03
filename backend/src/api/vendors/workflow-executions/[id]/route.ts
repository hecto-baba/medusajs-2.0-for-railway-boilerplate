import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getWorkflowPool } from "../route"
import { executionBelongsToSeller, executionOwnerPatterns } from "../scope"

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

    // Enforce multi-tenant scoping: the execution must have been run for this
    // seller (their id as the value of vendor_admin_id or vendor_id), the same
    // rule the list uses. A mere mention of their id is not enough.
    const owner = executionOwnerPatterns(vendorAdminId, vendorId)

    if (!owner || !executionBelongsToSeller(row, owner.js)) {
      res.status(404).json({ message: "Workflow execution not found" })
      return
    }

    res.json({ workflow_execution: row })
  } catch (err: any) {
    console.error("[VendorWorkflowExecutionDetail] Error:", err)
    res.status(500).json({ message: "Failed to load workflow execution" })
  }
}
