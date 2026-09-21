import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * Confirms the promotion behind a URL id belongs to the calling vendor.
 *
 * Mirrors products/helpers.ts assertOwnership. Deliberately a 404 rather than
 * a 403 - see that file for why.
 */
export const assertOwnership = async (
  req: AuthenticatedMedusaRequest,
  promotionId: string
): Promise<void> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.promotions.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const owns = vendorAdmin?.vendor?.promotions?.some(
    (promotion) => promotion?.id === promotionId
  )

  if (!owns) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Promotion not found.")
  }
}

/**
 * Returns the vendor id behind the calling admin.
 *
 * Used by the create route, which has to write a vendor link for a promotion
 * that does not exist yet.
 */
export const getVendorId = async (
  req: AuthenticatedMedusaRequest
): Promise<string> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorId = vendorAdmin?.vendor?.id

  if (!vendorId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  return vendorId
}

/**
 * The only attribute allowed on application_method target_rules and buy_rules.
 *
 * Those rules decide which items the discount applies to, so they stay on
 * "product" and the product ids are checked against the vendor's catalogue.
 * Top-level eligibility rules (who can use the code) are a separate path:
 * customer_group_id is allowed there, after the group ids are checked against
 * the vendor's own customer groups.
 */
export const VENDOR_ALLOWED_RULE_ATTRIBUTE = "product"

type PromotionRuleInput = {
  attribute?: string
  values?: string | string[]
}

/**
 * Rejects any product-targeting rule whose attribute is not "product".
 *
 * Call this on application_method.target_rules and buy_rules only. Top-level
 * eligibility rules are checked by assertEligibilityRulesBelongToVendor.
 */
export const assertOnlyProductRules = (rules?: PromotionRuleInput[]): void => {
  const disallowed = (rules ?? []).find(
    (rule) => rule.attribute && rule.attribute !== VENDOR_ALLOWED_RULE_ATTRIBUTE
  )

  if (disallowed) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Vendors can only scope promotion rules to "${VENDOR_ALLOWED_RULE_ATTRIBUTE}". ` +
        `"${disallowed.attribute}" is not allowed.`
    )
  }
}

/**
 * Confirms every product id referenced by a set of "product" rules belongs to
 * the calling vendor.
 *
 * assertOnlyProductRules guarantees every rule's attribute is "product", but
 * the values are still caller-controlled input: without this a vendor could
 * build a promotion whose target_rules/buy_rules discount another vendor's
 * products. Ids are checked in a single query, matching
 * assertVariantIdsBelongToProduct in products/helpers.ts.
 */
export const assertProductIdsBelongToVendor = async (
  req: AuthenticatedMedusaRequest,
  rules?: PromotionRuleInput[]
): Promise<void> => {
  const productIds = (rules ?? []).flatMap((rule) => {
    if (rule.attribute !== VENDOR_ALLOWED_RULE_ATTRIBUTE) {
      return []
    }

    return Array.isArray(rule.values) ? rule.values : [rule.values]
  }).filter((id): id is string => Boolean(id))

  if (!productIds.length) {
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const ownedIds = new Set(
    vendorAdmin?.vendor?.products?.map((product) => product?.id).filter(Boolean) ?? []
  )

  const foreignId = productIds.find((id) => !ownedIds.has(id))

  if (foreignId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "One or more products were not found in this vendor's catalogue."
    )
  }
}

import { getVendorCustomerGroupIds } from "../customers/helpers"

export const assertEligibilityRulesBelongToVendor = async (
  req: AuthenticatedMedusaRequest,
  rules?: PromotionRuleInput[]
): Promise<void> => {
  if (!rules?.length) return

  const customerGroupIds: string[] = []
  for (const rule of rules) {
    if (!rule.attribute) continue
    if (rule.attribute === "customer_group_id" || rule.attribute === "customer_group") {
      const vals = Array.isArray(rule.values) ? rule.values : [rule.values]
      customerGroupIds.push(...vals.filter((v): v is string => Boolean(v)))
    } else if (rule.attribute === "currency_code") {
      continue
    } else {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Vendors can only scope eligibility rules to "customer_group_id" or "currency_code". "${rule.attribute}" is not allowed.`
      )
    }
  }

  if (customerGroupIds.length) {
    const ownedGroupIds = new Set(await getVendorCustomerGroupIds(req))
    const foreignId = customerGroupIds.find((id) => !ownedGroupIds.has(id))
    if (foreignId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "One or more customer groups were not found in this vendor's account."
      )
    }
  }
}

/**
 * Runs the checks above against every rule array a promotion payload can
 * carry: the top-level `rules`, and application_method's `target_rules` /
 * `buy_rules`. Intended to be called on both create and update, since update
 * can introduce new rules just as easily as create can.
 */
export const assertPromotionRulesAreVendorScoped = async (
  req: AuthenticatedMedusaRequest,
  body: Record<string, any>
): Promise<void> => {
  if (body.rules) {
    await assertEligibilityRulesBelongToVendor(req, body.rules)
  }

  const productRuleSets: (PromotionRuleInput[] | undefined)[] = [
    body.application_method?.target_rules,
    body.application_method?.buy_rules,
  ]

  for (const rules of productRuleSets) {
    assertOnlyProductRules(rules)
    await assertProductIdsBelongToVendor(req, rules)
  }
}

/**
 * Rejects a promotion payload that tries to create a campaign inline.
 *
 * createPromotionsWorkflow/updatePromotionsWorkflow will happily create the
 * campaign object passed under `campaign` as part of the same call - but that
 * write has no request context for createRemoteLinkStep to hook into, so the
 * resulting campaign would be a real, visible-in-admin row with no vendor
 * link, orphaned forever (the same failure mode as the CSV-import gap
 * documented in PRODUCTS.md §7). Vendors must create a campaign through
 * POST /vendors/campaigns first - which does write the link - and then
 * reference it here by campaign_id.
 */
export const assertNoInlineCampaign = (body: Record<string, any>): void => {
  if (body.campaign) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Create the campaign first, then reference it by campaign_id."
    )
  }
}

/**
 * Confirms a campaign_id on a promotion payload belongs to the calling
 * vendor.
 *
 * Without this a vendor could attach their promotion to the platform's or
 * another vendor's campaign by guessing its id - campaign_id is otherwise
 * caller-controlled input exactly like the product ids in rules.
 */
export const assertCampaignBelongsToVendor = async (
  req: AuthenticatedMedusaRequest,
  campaignId?: string | null
): Promise<void> => {
  if (!campaignId) {
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.campaigns.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const owns = vendorAdmin?.vendor?.campaigns?.some(
    (campaign) => campaign?.id === campaignId
  )

  if (!owns) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Campaign not found.")
  }
}

/** Fields returned for a promotion in the vendor panel. */
export const VENDOR_PROMOTION_FIELDS = [
  "id",
  "code",
  "is_automatic",
  "is_tax_inclusive",
  "type",
  "status",
  "limit",
  "used",
  "created_at",
  "updated_at",
  "application_method.*",
  "application_method.target_rules.*",
  "application_method.target_rules.values.*",
  "application_method.buy_rules.*",
  "application_method.buy_rules.values.*",
  "rules.*",
  "rules.values.*",
]
