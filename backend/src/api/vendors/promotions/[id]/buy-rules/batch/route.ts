import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RuleType } from "@medusajs/framework/utils"
import { batchPromotionRulesWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertOnlyProductRules,
  assertOwnership,
  assertProductIdsBelongToVendor,
} from "../../../helpers"

/**
 * Manages a promotion's buy_rules (the items that must be bought, for
 * buyget promotions). Same guards as target-rules/batch - see that file.
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

  assertOnlyProductRules(body.create)
  assertOnlyProductRules(body.update)
  await assertProductIdsBelongToVendor(req, body.create)
  await assertProductIdsBelongToVendor(req, body.update)

  const { result } = await batchPromotionRulesWorkflow(req.scope).run({
    input: {
      id,
      rule_type: RuleType.BUY_RULES,
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
