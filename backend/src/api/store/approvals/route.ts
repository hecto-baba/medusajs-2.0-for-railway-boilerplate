import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { APPROVAL_MODULE } from "../../../modules/approval"
import { emitSafely } from "../../../lib/emit-safely"

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

    // Only the approvals of carts that belong to this company (was: every approval of
    // every company, filtered in memory afterwards).
    const { data: companyCarts } = companyCustomerIds.length
      ? await query.graph({ entity: "cart", fields: ["id"], filters: { customer_id: companyCustomerIds } })
      : { data: [] as any[] }
    const companyCartIds = (companyCarts || []).map((cart: any) => cart.id)
    if (!companyCartIds.length) {
      return res.json({ approvals: [] })
    }

    const { data: approvals } = await query.graph({
      entity: "approval",
      filters: { cart_id: companyCartIds },
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
  let callerCompanyId: string | null = null
  try {
    const { data: [caller] } = await query.graph({
      entity: "customer",
      fields: ["id", "employee.is_admin", "employee.company.id"],
      filters: { id: customerId },
    })

    const isManager = Boolean((caller as any)?.employee?.is_admin)
    callerCompanyId = (caller as any)?.employee?.company?.id ?? null
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

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "status must be approved or rejected" })
  }

  // A manager decides only their OWN company's spending requests: the approval's cart
  // must belong to a customer of the caller's company. Anything else is "not found".
  const { data: [target] } = await query.graph({
    entity: "approval",
    fields: ["id", "cart_id", "created_by"],
    filters: { id: approval_id },
  })
  let sameCompany = false
  if (target && callerCompanyId) {
    const { data: [cart] } = await query.graph({
      entity: "cart",
      fields: ["id", "customer_id"],
      filters: { id: target.cart_id },
    })
    const ownerId = cart?.customer_id || target.created_by
    if (ownerId) {
      const { data: [owner] } = await query.graph({
        entity: "customer",
        fields: ["id", "employee.company.id"],
        filters: { id: ownerId },
      })
      sameCompany = (owner as any)?.employee?.company?.id === callerCompanyId
    }
  }
  if (!sameCompany) {
    return res.status(404).json({ message: "Approval not found" })
  }

  const approvalStatus = await approvalModule.createApprovalStatuses({
    approval_id,
    status,
    type: "admin",
    created_by: customerId,
  })

  // The employee is emailed from this event; a failed emit never fails the decision.
  await emitSafely(req.scope, "approval.decided", {
    approval_id,
    status,
    approval_status_id: (approvalStatus as any)?.id,
  })

  return res.status(200).json({
    success: true,
    approval_status: approvalStatus,
  })
}
