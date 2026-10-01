import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as crypto from "crypto"
import { getWorkflowPool } from "../../../workflow-executions/route"

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  const {
    data: [currentAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorId = currentAdmin?.vendor?.id
  if (!vendorId) {
    res.status(404).json({ message: "Vendor profile not found." })
    return
  }

  const pool = getWorkflowPool()
  const result = await pool.query(
    `DELETE FROM invite
     WHERE id = $1 AND metadata->>'vendor_id' = $2
     RETURNING id`,
    [id, vendorId]
  )

  if (result.rowCount === 0) {
    res.status(404).json({ message: "Invitation not found." })
    return
  }

  res.json({ id, object: "invite", deleted: true })
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  const {
    data: [currentAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorId = currentAdmin?.vendor?.id
  if (!vendorId) {
    res.status(404).json({ message: "Vendor profile not found." })
    return
  }

  const pool = getWorkflowPool()
  const newToken = crypto.randomBytes(32).toString("hex")
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const result = await pool.query(
    `UPDATE invite
     SET token = $1, expires_at = $2, updated_at = NOW()
     WHERE id = $3 AND metadata->>'vendor_id' = $4 AND deleted_at IS NULL
     RETURNING id, email, token, expires_at, created_at, metadata`,
    [newToken, newExpiresAt, id, vendorId]
  )

  if (result.rowCount === 0) {
    res.status(404).json({ message: "Invitation not found." })
    return
  }

  const row = result.rows[0]
  res.json({
    invite: {
      id: row.id,
      email: row.email,
      token: row.token,
      expires_at: row.expires_at,
      created_at: row.created_at,
      first_name: row.metadata?.first_name || null,
      last_name: row.metadata?.last_name || null,
      status: "pending",
    },
  })
}
