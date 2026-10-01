import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getVendorId } from "../shared/vendor-scope"
import { getVendorCustomerGroupIds } from "../customers/helpers"

// Single source of truth lives in shared/vendor-scope.ts; re-exported so
// existing imports from this file keep working.
export { getVendorId }


/**
 * Returns all price list IDs that belong to the calling vendor.
 */
export const getVendorPriceListIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.price_lists.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  return (
    (vendorAdmin.vendor as any).price_lists as { id?: string }[] | undefined
  )
    ?.map((p) => p?.id)
    .filter((id): id is string => !!id) ?? []
}

/**
 * Confirms the calling vendor owns the price list.
 */
export const assertVendorOwnsPriceList = async (
  req: AuthenticatedMedusaRequest,
  priceListId: string,
  notFoundMessage = "Price list not found."
): Promise<void> => {
  const ownedIds = await getVendorPriceListIds(req)

  if (!ownedIds.includes(priceListId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}

/**
 * Returns all product variant IDs owned by the calling vendor.
 */
export const getVendorVariantIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.products.variants.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    return []
  }

  const products = (vendorAdmin.vendor as any).products as
    | { variants?: { id?: string }[] }[]
    | undefined

  const variantIds: string[] = []
  for (const prod of products ?? []) {
    for (const v of prod.variants ?? []) {
      if (v?.id) {
        variantIds.push(v.id)
      }
    }
  }

  return variantIds
}

/**
 * Asserts that all given variant IDs belong to the vendor's products.
 */
export const assertVendorOwnsVariants = async (
  req: AuthenticatedMedusaRequest,
  variantIds: string[]
): Promise<void> => {
  if (!variantIds || !variantIds.length) return

  const ownedVariantIds = await getVendorVariantIds(req)
  const unauthorized = variantIds.filter((vid) => !ownedVariantIds.includes(vid))

  if (unauthorized.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Cannot set prices on variants outside vendor store: ${unauthorized.join(", ")}`
    )
  }
}

/** Fields returned for price list queries */
export const VENDOR_PRICE_LIST_FIELDS = [
  "id",
  "title",
  "description",
  "status",
  "type",
  "starts_at",
  "ends_at",
  "rules",
  "prices.*",
  "prices.price_set.variant.id",
  "prices.price_set.variant.title",
  "prices.price_set.variant.sku",
  "prices.price_set.variant.product.id",
  "prices.price_set.variant.product.title",
  "prices.price_set.variant.product.thumbnail",
  "created_at",
  "updated_at",
]

/**
 * Enriches and transforms raw price list records into a structured format.
 */
export const transformVendorPriceList = (priceList: any) => {
  const prices = priceList.prices ?? []

  // Group prices by product and variant
  const productMap = new Map<string, any>()

  for (const price of prices) {
    const variant = price.price_set?.variant
    const product = variant?.product

    if (product) {
      if (!productMap.has(product.id)) {
        productMap.set(product.id, {
          id: product.id,
          title: product.title,
          thumbnail: product.thumbnail,
          variants: [],
        })
      }

      const prod = productMap.get(product.id)
      let varObj = prod.variants.find((v: any) => v.id === variant.id)
      if (!varObj) {
        varObj = {
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          prices: [],
        }
        prod.variants.push(varObj)
      }

      varObj.prices.push({
        id: price.id,
        currency_code: price.currency_code,
        amount: price.amount,
        min_quantity: price.min_quantity,
        max_quantity: price.max_quantity,
        rules: price.rules,
      })
    }
  }

  const products = Array.from(productMap.values())

  return {
    ...priceList,
    products_count: products.length,
    prices_count: prices.length,
    products,
  }
}

/**
 * Refetches a vendor price list by ID with all relations.
 */
export const refetchVendorPriceList = async (
  id: string,
  req: AuthenticatedMedusaRequest
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [priceList],
  } = await query.graph({
    entity: "price_list",
    fields: VENDOR_PRICE_LIST_FIELDS,
    filters: { id: [id] },
  })

  if (!priceList) {
    return null
  }

  return transformVendorPriceList(priceList)
}

/**
 * Every price id named in a batch body must belong to THIS price list. The list
 * itself is checked, but the ids in update and delete come from the body, so
 * without this a seller could name another seller's price id on their own list
 * and change or delete it.
 */
export const assertPricesBelongToPriceList = async (
  req: AuthenticatedMedusaRequest,
  priceListId: string,
  priceIds: string[]
): Promise<void> => {
  const ids = Array.from(new Set(priceIds.filter(Boolean)))

  if (!ids.length) {
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [priceList],
  } = await query.graph({
    entity: "price_list",
    fields: ["id", "prices.id"],
    filters: { id: [priceListId] },
  })

  const own = new Set(((priceList as any)?.prices ?? []).map((price: any) => price?.id))

  if (ids.some((id) => !own.has(id))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Price not found.")
  }
}

/**
 * A price list may only target the seller's own customer groups. Group ids come
 * in the body's rules, so another seller's group answers 404.
 */
export const assertPriceListRulesBelongToVendor = async (
  req: AuthenticatedMedusaRequest,
  rules?: Record<string, string[]> | null
): Promise<void> => {
  const groupIds = (rules?.customer_group_id ?? []).filter(Boolean)

  if (!groupIds.length) {
    return
  }

  const owned = new Set(await getVendorCustomerGroupIds(req))

  if (groupIds.some((id) => !owned.has(id))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer group not found.")
  }
}
