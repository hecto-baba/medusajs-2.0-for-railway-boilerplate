import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Seller tax (Phase 2, step 4; supersedes the custom-provider idea in D4).
 *
 * A seller's tax rate is an ordinary, non-default Medusa tax rate inside a
 * platform country tax region, linked to the seller, with one rule per product
 * and per shipping option the seller owns. Medusa picks a rate with a matching
 * rule before the region's default rate, so the seller's rate applies to their
 * own products and shipping and to nothing else. Anything the seller has not
 * set a rate for keeps the platform's rate.
 *
 * Rules are plain rows, so they have to be kept up to date when the seller adds
 * a product or a shipping option: call syncVendorTaxRules after either. It only
 * ever adds missing rules, so it is safe to call as often as needed.
 */

type Reference = { reference: "product" | "shipping_option"; reference_id: string }

/** Everything of the seller's that a tax rate has to cover. */
const getVendorTaxReferences = async (
  container: MedusaContainer,
  vendorId: string
): Promise<Reference[]> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendor],
  } = await query.graph({
    entity: "vendor",
    fields: [
      "id",
      "products.id",
      "stock_locations.fulfillment_sets.service_zones.shipping_options.id",
    ],
    filters: { id: [vendorId] },
  })

  const refs: Reference[] = []
  for (const product of vendor?.products ?? []) {
    refs.push({ reference: "product", reference_id: product.id })
  }
  for (const location of vendor?.stock_locations ?? []) {
    for (const set of location?.fulfillment_sets ?? []) {
      for (const zone of set?.service_zones ?? []) {
        for (const option of zone?.shipping_options ?? []) {
          refs.push({ reference: "shipping_option", reference_id: option.id })
        }
      }
    }
  }
  return refs
}

/**
 * Makes every tax rate of the seller (or just `onlyRateIds`) cover all of the
 * seller's products and shipping options. Returns how many rules were added.
 */
export const syncVendorTaxRules = async (
  container: MedusaContainer,
  vendorId: string,
  onlyRateIds?: string[]
): Promise<number> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const taxModule: any = container.resolve(Modules.TAX)

  const {
    data: [vendor],
  } = await query.graph({
    entity: "vendor",
    fields: ["id", "tax_rates.id", "tax_rates.rules.reference", "tax_rates.rules.reference_id"],
    filters: { id: [vendorId] },
  })

  const rates = ((vendor?.tax_rates ?? []) as any[]).filter(
    (rate) => !onlyRateIds || onlyRateIds.includes(rate.id)
  )
  if (!rates.length) {
    return 0
  }

  const wanted = await getVendorTaxReferences(container, vendorId)

  const toCreate: Array<Reference & { tax_rate_id: string }> = []
  for (const rate of rates) {
    const have = new Set((rate.rules ?? []).map((rule: any) => `${rule.reference}:${rule.reference_id}`))
    for (const ref of wanted) {
      if (!have.has(`${ref.reference}:${ref.reference_id}`)) {
        toCreate.push({ tax_rate_id: rate.id, ...ref })
      }
    }
  }

  if (toCreate.length) {
    await taxModule.createTaxRateRules(toCreate)
  }
  return toCreate.length
}
