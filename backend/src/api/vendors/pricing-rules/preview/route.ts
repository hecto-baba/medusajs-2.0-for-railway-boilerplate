import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { applyPricingRules } from "../../../../modules/appointment-booking/lib/pricing"
import {
  assertResourceOwned,
  getAppointmentService,
  resolveVendorId,
} from "../../resources/helpers"
import { GetPricingPreviewSchema } from "../../resources/schemas"
import { assertRuleScopeOwned } from "../route"

/**
 * "What would this slot cost?" for the pricing-rules screen. The base price is
 * supplied by the caller (the UI reads it from the product's variant) because
 * this is only a preview - the real booking recomputes the price on the server
 * from the variant's stored price and never trusts a client value.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const q = req.validatedQuery as z.infer<typeof GetPricingPreviewSchema>
  const resource = await assertResourceOwned(req, q.resource_id)
  await assertRuleScopeOwned(req, { product_id: q.product_id })

  const service = getAppointmentService(req)
  const vendorId = await resolveVendorId(req)

  const rules = await service.listPricingRules(
    { vendor_id: vendorId, is_active: true },
    { take: null }
  )

  const result = applyPricingRules(
    q.base_price,
    rules.map((r) => ({
      ...r,
      days_of_week: (r.days_of_week as unknown as number[] | null) ?? null,
    })),
    {
      resource_id: resource.id,
      product_id: q.product_id,
      start: q.start,
      timezone: resource.timezone,
      currency_code: q.currency_code,
    }
  )

  res.json(result)
}
