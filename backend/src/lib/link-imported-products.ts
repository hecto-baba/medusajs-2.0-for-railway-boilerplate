import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

/** An import that has not finished within this window no longer claims its handles. */
const IMPORT_ACTIVE_MS = 24 * 60 * 60 * 1000

/**
 * Links a product created by a CSV import to the seller who started that import.
 *
 * Medusa's importer creates products in a background step with no request, so
 * nothing knows which seller they belong to, and they would stay orphaned (not in
 * the seller's own list, failing every ownership check). The import is recorded
 * against the seller when it starts (vendor_product_import), together with the
 * handles it will create. Handles are unique across products, and two sellers
 * cannot have the same handle in active imports (checked when an import starts),
 * so a newly created product's handle identifies its import and its seller.
 *
 * Idempotent and conservative: it does nothing unless the product's handle is in
 * an active import, and it never overwrites an existing seller link.
 *
 * Returns the seller id the product was linked to, or null.
 */
export const linkImportedProductToVendor = async (
  container: MedusaContainer,
  productId: string
): Promise<string | null> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { id: [productId] },
  })

  if (!product?.handle) {
    return null
  }

  const marketplace: any = container.resolve(MARKETPLACE_MODULE)
  const records: Array<{ vendor_id: string; handles: string[]; created_at: Date | string }> =
    await marketplace.listVendorProductImports({})

  const owner = records.find(
    (record) =>
      Date.now() - new Date(record.created_at).getTime() < IMPORT_ACTIVE_MS &&
      (record.handles ?? []).includes(product.handle)
  )

  if (!owner) {
    return null
  }

  // Never take over a product that already belongs to a seller.
  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: ["id", "products.id"],
  })

  const alreadyLinked = (vendors ?? []).some((vendor: any) =>
    (vendor?.products ?? []).some((linked: any) => linked?.id === productId)
  )

  if (alreadyLinked) {
    return null
  }

  const link: any = container.resolve(ContainerRegistrationKeys.LINK)
  await link.create({
    [MARKETPLACE_MODULE]: { vendor_id: owner.vendor_id },
    [Modules.PRODUCT]: { product_id: productId },
  })

  return owner.vendor_id
}
