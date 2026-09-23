import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { APPROVAL_MODULE } from "../../../modules/approval"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

  try {
    const { data: approvals, metadata } = await query.graph({
      entity: "approval",
      fields: [
        "id",
        "cart_id",
        "created_by",
        "created_at",
        "statuses.*",
        "cart.*",
        "cart.total",
        "cart.currency_code",
        "cart.customer.*",
      ],
      pagination: {
        take: limit,
        skip: offset,
      },
    })

    return res.json({
      approvals,
      count: metadata?.count ?? approvals.length,
      limit,
      offset,
    })
  } catch (error) {
    const approvalModule = req.scope.resolve(APPROVAL_MODULE) as any
    const [approvals, count] = await approvalModule.listAndCountApprovals({}, {
      take: limit,
      skip: offset,
    })

    return res.json({
      approvals,
      count,
      limit,
      offset,
    })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const approvalModule = req.scope.resolve(APPROVAL_MODULE) as any
  const body = (req.body || {}) as any
  const { approval_id, status = "approved", type = "admin" } = body

  if (!approval_id) {
    return res.status(400).json({ message: "approval_id is required" })
  }

  const approvalStatus = await approvalModule.createApprovalStatuses({
    approval_id,
    status,
    type,
    created_by: (req as any).user?.id || "admin",
  })

  return res.status(200).json({ approval_status: approvalStatus })
}
