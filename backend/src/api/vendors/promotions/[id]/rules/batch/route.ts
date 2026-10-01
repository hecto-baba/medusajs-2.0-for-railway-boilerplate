import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RuleType } from "@medusajs/framework/utils"
import { batchPromotionRulesWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertEligibilityRulesBelongToVendor,
  assertOwnership,
} from "../../../helpers"

/**
 * Manages a promotion's top-level eligibility rules (who can use this code - e.g. customer_group_id).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const body = req.validatedBody as {
    create?: Record<string, any>[]
    update?: Record<string, any>[]
    delete?: string[]
  }

  await assertEligibilityRulesBelongToVendor(req, body.create)
  await assertEligibilityRulesBelongToVendor(req, body.update)

  const { result } = await batchPromotionRulesWorkflow(req.scope).run({
    input: {
      id,
      rule_type: RuleType.RULES,
      create: body.create as any,
      update: body.update as any,
      delete: body.delete,
    },
  })

  res.status(200).json({
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
  })
}
