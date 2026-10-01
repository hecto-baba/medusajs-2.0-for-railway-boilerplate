import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import * as crypto from "crypto"
import { getWorkflowPool } from "../../workflow-executions/route"

export const CreateVendorInviteSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

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
    `SELECT id, email, token, expires_at, created_at, metadata
     FROM invite
     WHERE metadata->>'vendor_id' = $1
       AND deleted_at IS NULL
       AND accepted = false
     ORDER BY created_at DESC`,
    [vendorId]
  )

  const now = new Date()
  const invites = result.rows.map((row) => {
    const isExpired = new Date(row.expires_at) < now
    return {
      id: row.id,
      email: row.email,
      token: row.token,
      expires_at: row.expires_at,
      created_at: row.created_at,
      first_name: row.metadata?.first_name || null,
      last_name: row.metadata?.last_name || null,
      status: isExpired ? "expired" : "pending",
    }
  })

  res.json({ invites })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorInviteSchema>>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { email, first_name, last_name } = req.validatedBody

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

  // Check if member already exists in vendor team
  const existingAdmin = await pool.query(
    `SELECT id FROM vendor_admin WHERE vendor_id = $1 AND email = $2`,
    [vendorId, email]
  )
  if (existingAdmin.rows.length > 0) {
    res.status(400).json({ message: "A team member with this email already belongs to your store." })
    return
  }

  // Generate invite
  const id = `inv_${crypto.randomBytes(12).toString("hex")}`
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const metadata = {
    vendor_id: vendorId,
    first_name: first_name || null,
    last_name: last_name || null,
  }

  await pool.query(
    `INSERT INTO invite (id, email, accepted, token, expires_at, metadata, created_at, updated_at)
     VALUES ($1, $2, false, $3, $4, $5, NOW(), NOW())`,
    [id, email, token, expiresAt, JSON.stringify(metadata)]
  )

  res.status(201).json({
    invite: {
      id,
      email,
      token,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      first_name: first_name || null,
      last_name: last_name || null,
      status: "pending",
    },
  })
}
