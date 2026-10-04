import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { validatePricingRule } from "../../../modules/appointment-booking/lib/pricing"
import {
  getAppointmentService,
  listOwnedResourceIds,
  resolveVendorId,
} from "../resources/helpers"
import { PostPricingRuleSchema } from "../resources/schemas"
import { assertVendorOwnsAll } from "../shared/vendor-scope"

const MAX_RULES_PER_VENDOR = 100

/** Verifies that the resource/product a rule is scoped to belong to the vendor. */
export const assertRuleScopeOwned = async (
  req: AuthenticatedMedusaRequest,
  scope: { resource_id?: string | null; product_id?: string | null }
) => {
  if (scope.resource_id) {
    const owned = await listOwnedResourceIds(req)
    if (!owned.includes(scope.resource_id)) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found.")
    }
  }
  if (scope.product_id) {
    await assertVendorOwnsAll(req, "products", [scope.product_id], "Product not found.")
  }
}

/** The vendor's pricing rules, highest priority first. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service = getAppointmentService(req)
  const vendorId = await resolveVendorId(req)
  const resourceId = typeof req.query.resource_id === "string" ? req.query.resource_id : undefined

  const rules = await service.listPricingRules(
    { vendor_id: vendorId, ...(resourceId ? { resource_id: resourceId } : {}) },
    { take: null, order: { priority: "DESC", created_at: "ASC" } }
  )

  res.json({ pricing_rules: rules })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostPricingRuleSchema>>,
  res: MedusaResponse
) => {
  const service = getAppointmentService(req)
  const vendorId = await resolveVendorId(req)
  const body = req.validatedBody

  const problem = validatePricingRule(body)
  if (problem) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
  }

  await assertRuleScopeOwned(req, body)

  const [, count] = await service.listAndCountPricingRules(
    { vendor_id: vendorId },
    { take: 1 }
  )
  if (count >= MAX_RULES_PER_VENDOR) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `You can have at most ${MAX_RULES_PER_VENDOR} pricing rules.`
    )
  }

  const rule = await service.createPricingRules({
    vendor_id: vendorId,
    resource_id: body.resource_id ?? null,
    product_id: body.product_id ?? null,
    name: body.name,
    type: body.type,
    value: body.value,
    currency_code: body.currency_code ? body.currency_code.toLowerCase() : null,
    // The model stores days as a json column, which the generated type calls a
    // Record; it really holds an array of weekday numbers.
    days_of_week: (body.days_of_week ?? null) as unknown as Record<string, unknown> | null,
    start_time: body.start_time ?? null,
    end_time: body.end_time ?? null,
    valid_from: body.valid_from ?? null,
    valid_until: body.valid_until ?? null,
    priority: body.priority ?? 0,
    is_active: body.is_active ?? true,
  })

  res.status(201).json({ pricing_rule: rule })
}
