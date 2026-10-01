import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { assertVendorCanSee, getVisibleIds, ScopedEntity } from "../shared/platform-scope"
import { assertVendorOwns } from "../shared/vendor-scope"
import { getVendorCustomerIds } from "../customers/helpers"
import { getVendorVariantIds } from "../price-lists/helpers"

const SALES_CHANNELS: ScopedEntity = {
  linkField: "sales_channels",
  entity: "sales_channel",
}

const PROMOTIONS: ScopedEntity = {
  linkField: "promotions",
  entity: "promotion",
}

const notFound = (what: string) =>
  new MedusaError(MedusaError.Types.NOT_FOUND, `${what} not found.`)

/**
 * A draft order is an order linked to the seller when it was created. Another
 * seller's draft answers 404.
 */
export const assertVendorOwnsDraftOrder = (
  req: AuthenticatedMedusaRequest,
  draftOrderId: string
): Promise<void> =>
  assertVendorOwns(req, "orders", draftOrderId, "Draft order not found.")

type DraftOrderReferences = {
  customer_id?: string | null
  sales_channel_id?: string | null
  items?: Array<{ variant_id?: string | null }> | null
  promo_codes?: string[] | null
}

/**
 * Every id in a draft-order create body must be one the seller can use.
 *
 * Without this, naming a stranger's customer on a draft order linked that order
 * to the seller, and customer access is derived from linked orders, so the
 * seller then "owned" a customer they had never dealt with.
 *
 *   - customer:     one of the seller's customers (linked or ordered from them)
 *   - variants:     variants of the seller's own products
 *   - sales channel: the seller's own or a shared platform channel
 *   - promo codes:  promotions the seller owns or shared platform promotions
 *
 * Anything else answers 404 before the order is created.
 */
export const assertVendorCanUseDraftOrderReferences = async (
  req: AuthenticatedMedusaRequest,
  input: DraftOrderReferences
): Promise<void> => {
  if (input.customer_id) {
    const customerIds = await getVendorCustomerIds(req)
    if (!customerIds.includes(input.customer_id)) {
      throw notFound("Customer")
    }
  }

  const variantIds = (input.items ?? [])
    .map((item) => item?.variant_id)
    .filter((id): id is string => !!id)

  if (variantIds.length) {
    const owned = new Set(await getVendorVariantIds(req))
    if (variantIds.some((id) => !owned.has(id))) {
      throw notFound("Product variant")
    }
  }

  if (input.sales_channel_id) {
    await assertVendorCanSee(req, SALES_CHANNELS, input.sales_channel_id, "Sales channel not found.")
  }

  const codes = (input.promo_codes ?? []).filter(Boolean)
  if (codes.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: promotions } = await query.graph({
      entity: "promotion",
      fields: ["id", "code"],
      filters: { code: codes },
    })

    const { owned, platform } = await getVisibleIds(req, PROMOTIONS)
    const visible = new Set([...owned, ...platform])

    // A code that matches a promotion the seller cannot use is a 404; a code
    // that matches nothing is left for the core workflow to reject.
    if ((promotions ?? []).some((promotion: any) => !visible.has(promotion.id))) {
      throw notFound("Promotion")
    }
  }
}
