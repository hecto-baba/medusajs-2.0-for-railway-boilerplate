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
 * Manages a promotion's target_rules (the items a discount applies to).
 *
 * Only the "product" attribute is allowed - see helpers.ts - and every
 * product id in the payload is checked against the vendor's own catalogue,
 * the same "check body ids too" rule the products routes follow for batch
 * variant/image ids.
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
      rule_type: RuleType.TARGET_RULES,
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
