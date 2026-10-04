import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { APPROVAL_MODULE } from "../../../../../modules/approval"
import { canUseCart } from "../../../helpers/cart-access"
import { emitSafely } from "../../../../../lib/emit-safely"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const approvalModule = req.scope.resolve(APPROVAL_MODULE) as any
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const cartId = req.params.id
  const actorId = (req as any).auth_context?.actor_id
  // Anonymous callers used to be recorded as "employee" and could queue approvals on any cart.
  if (!actorId) {
    return res.status(401).json({ message: "Not authenticated" })
  }
  if (!(await canUseCart(req, cartId))) {
    return res.status(404).json({ message: "Cart not found" })
  }

  try {
    const approval = await approvalModule.createApprovals({
      cart_id: cartId,
      created_by: actorId,
    })

    await approvalModule.createApprovalStatuses({
      approval_id: approval.id,
      status: "pending",
      type: "admin",
      created_by: actorId,
    })

    if (remoteLink) {
      await remoteLink.create({
        [APPROVAL_MODULE]: {
          approval_id: approval.id,
        },
        [Modules.CART]: {
          cart_id: cartId,
        },
      })
    }

    // Managers are emailed from this event; a failed emit never fails the submit.
    await emitSafely(req.scope, "approval.requested", { approval_id: approval.id })

    return res.status(201).json({
      success: true,
      message: "Order submitted for manager approval",
      approval,
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to submit for approval",
    })
  }
}
