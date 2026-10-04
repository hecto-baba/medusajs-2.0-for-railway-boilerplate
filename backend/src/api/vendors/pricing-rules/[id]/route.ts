import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { validatePricingRule } from "../../../../modules/appointment-booking/lib/pricing"
import { getAppointmentService, resolveVendorId } from "../../resources/helpers"
import { UpdatePricingRuleSchema } from "../../resources/schemas"
import { assertRuleScopeOwned } from "../route"

const loadOwnedRule = async (req: AuthenticatedMedusaRequest, id: string) => {
  const service = getAppointmentService(req)
  const vendorId = await resolveVendorId(req)
  const [rule] = await service.listPricingRules({ id, vendor_id: vendorId }, { take: 1 })
  if (!rule) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Pricing rule not found.")
  }
  return { service, rule }
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdatePricingRuleSchema>>,
  res: MedusaResponse
) => {
  const { service, rule } = await loadOwnedRule(req, req.params.id)
  const body = req.validatedBody

  const changes = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined)
  ) as Record<string, any>

  if (changes.currency_code) changes.currency_code = String(changes.currency_code).toLowerCase()

  const merged = { ...rule, ...changes }

  const problem = validatePricingRule(merged as any)
  if (problem) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
  }

  await assertRuleScopeOwned(req, {
    resource_id: "resource_id" in changes ? changes.resource_id : undefined,
    product_id: "product_id" in changes ? changes.product_id : undefined,
  })

  const updated = await service.updatePricingRules({ id: rule.id, ...changes })

  res.json({ pricing_rule: updated })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { service, rule } = await loadOwnedRule(req, req.params.id)

  await service.deletePricingRules(rule.id)

  res.json({ id: rule.id, deleted: true })
}
