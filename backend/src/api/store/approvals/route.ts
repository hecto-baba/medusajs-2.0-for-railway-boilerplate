import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { APPROVAL_MODULE } from "../../../modules/approval"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // 1. Find caller's company
    const { data: [caller] } = await query.graph({
      entity: "customer",
      fields: ["id", "employee.company.id", "employee.is_admin"],
      filters: { id: customerId },
    })

    const companyId = (caller as any)?.employee?.company?.id
    if (!companyId) {
      return res.json({ approvals: [] })
    }

    // 2. Find all customer IDs in this company
    const { data: employees } = await query.graph({
      entity: "employee",
      fields: ["customer_id"],
      filters: { company_id: companyId },
    })

    const companyCustomerIds = (employees || [])
      .map((e: any) => e.customer_id)
      .filter(Boolean)

    const { data: approvals } = await query.graph({
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
        "cart.items.*",
        "cart.customer.*",
      ],
    })

    // Filter approvals to carts belonging to customers in this company
    const companyApprovals = (approvals || []).filter((appr: any) => {
      const cartCustId = appr.cart?.customer?.id || appr.created_by
      return companyCustomerIds.includes(cartCustId)
    })

    return res.json({ approvals: companyApprovals })
  } catch (error) {
    return res.json({ approvals: [] })
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const approvalModule = req.scope.resolve(APPROVAL_MODULE) as any

  // Verify caller is a company manager
  try {
    const { data: [caller] } = await query.graph({
      entity: "customer",
      fields: ["id", "employee.is_admin", "employee.company.id"],
      filters: { id: customerId },
    })

    const isManager = Boolean((caller as any)?.employee?.is_admin)
    if (!isManager) {
      return res.status(403).json({
        message: "Only company managers can approve or reject spending requests.",
      })
    }
  } catch (err: any) {
    return res.status(403).json({ message: "Unauthorized" })
  }

  const body = (req.body || {}) as any
  const { approval_id, status = "approved" } = body

  if (!approval_id) {
    return res.status(400).json({ message: "approval_id is required" })
  }

  const approvalStatus = await approvalModule.createApprovalStatuses({
    approval_id,
    status,
    type: "admin",
    created_by: customerId,
  })

  return res.status(200).json({
    success: true,
    approval_status: approvalStatus,
  })
}
