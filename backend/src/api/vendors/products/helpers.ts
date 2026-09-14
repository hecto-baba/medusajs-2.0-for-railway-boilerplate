import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createInventoryItemsWorkflow } from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"

/**
 * Confirms the product behind a URL id belongs to the calling vendor.
 *
 * Every vendor product route funnels through here. The actor gate on the
 * route only proves the caller is *a* vendor; it says nothing about whether
 * this particular product is theirs, so without this check any authenticated
 * vendor could read or edit another's catalogue by guessing an id.
 *
 * Sub-resources (variants, options, images, inventory links) deliberately do
 * not carry ownership checks of their own: each hangs off a product, so
 * guarding the parent id covers them. A variant id in the URL is still
 * verified to belong to that product - see assertVariantBelongsToProduct.
 *
 * Deliberately a 404 rather than a 403: telling a vendor that a product
 * exists but is not theirs would confirm the id belongs to someone else.
 */
export const assertOwnership = async (
  req: AuthenticatedMedusaRequest,
  productId: string
): Promise<void> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const owns = vendorAdmin?.vendor?.products?.some(
    (product) => product?.id === productId
  )

  if (!owns) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found.")
  }
}

/**
 * Confirms a variant id belongs to the given product.
 *
 * assertOwnership proves the vendor owns the product in the URL, but the
 * variant id is a second piece of caller-controlled input. Without this a
 * vendor could pass their own product id alongside someone else's variant id
 * and have the core workflow act on a variant they do not own.
 */
export const assertVariantBelongsToProduct = async (
  req: AuthenticatedMedusaRequest,
  productId: string,
  variantId: string
): Promise<void> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id"],
    filters: { id: [variantId], product_id: [productId] },
  })

  if (!variants.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Variant not found.")
  }
}

/**
 * Returns the vendor id behind the calling admin.
 *
 * Used by routes that create products (batch, import) and therefore need to
 * write vendor links for rows that do not exist yet.
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
 * Confirms every variant id in a request *body* belongs to the given product.
 *
 * Batch routes take variant ids in the payload rather than the URL, so the
 * parent product check is not enough on its own: a vendor could pair their own
 * product id with another vendor's variant ids and have the core workflow act
 * on rows they do not own.
 *
 * The ids are checked in a single query rather than one at a time - a batch can
 * carry dozens, and a per-id round trip would make the request cost scale with
 * the size of the payload.
 */
export const assertVariantIdsBelongToProduct = async (
  req: AuthenticatedMedusaRequest,
  productId: string,
  variantIds: string[]
): Promise<void> => {
  const ids = variantIds.filter(Boolean)

  if (!ids.length) {
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id"],
    filters: { id: ids, product_id: [productId] },
  })

  // A count mismatch means at least one id is not a variant of this product -
  // either it does not exist, or it belongs elsewhere. Both answer the same
  // way so the response cannot be used to probe for foreign ids.
  if (variants.length !== new Set(ids).size) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "One or more variants were not found on this product."
    )
  }
}


/**
 * Confirms every image id belongs to the given product.
 *
 * Image ids arrive from the URL or the body on the image-variant routes, and
 * an image is only a vendor's by virtue of hanging off their product - the File
 * module itself records no owner. Without this check a vendor could attach
 * another vendor's image to their own variant.
 */
export const assertImageIdsBelongToProduct = async (
  req: AuthenticatedMedusaRequest,
  productId: string,
  imageIds: string[]
): Promise<void> => {
  const ids = imageIds.filter(Boolean)

  if (!ids.length) {
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: images } = await query.graph({
    entity: "product_image",
    fields: ["id"],
    filters: { id: ids, product_id: [productId] },
  })

  if (images.length !== new Set(ids).size) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "One or more images were not found on this product."
    )
  }
}

/** Fields returned for a single variant in the vendor panel. */
export const VENDOR_VARIANT_FIELDS = [
  "id",
  "title",
  "sku",
  "barcode",
  "ean",
  "upc",
  "manage_inventory",
  "allow_backorder",
  "weight",
  "length",
  "height",
  "width",
  "hs_code",
  "mid_code",
  "origin_country",
  "material",
  "metadata",
  "created_at",
  "updated_at",
  "options.*",
  "prices.*",
  "inventory_items.*",
  // The inventory item itself, not just the link row - the panel shows sku
  // and stock alongside the required quantity. "inventory_items.inventory.*"
  // is not a valid path and silently drops the whole relation.
  "inventory.*",
]

/** Fields returned for a product detail view in the vendor panel. */
export const VENDOR_PRODUCT_DETAIL_FIELDS = [
  "id",
  "title",
  "subtitle",
  "description",
  "handle",
  "status",
  "thumbnail",
  "weight",
  "length",
  "height",
  "width",
  "hs_code",
  "mid_code",
  "origin_country",
  "material",
  "discountable",
  "metadata",
  "created_at",
  "updated_at",
  "collection.id",
  "collection.title",
  "categories.id",
  "categories.name",
  "tags.id",
  "tags.value",
  "type.id",
  "type.value",
  "sales_channels.id",
  "sales_channels.name",
  // The relation is only resolved by the wildcard form; naming individual
  // columns on it silently returns nothing.
  "shipping_profile.*",
  "images.*",
  "options.*",
  "options.values.*",
  "variants.*",
  "variants.options.*",
  "variants.prices.*",
]

/**
 * Ensures an inventory item exists for the variant and is linked to both
 * the variant and the vendor. Returns the inventory item ID.
 */
export const ensureVariantInventoryItem = async (
  req: AuthenticatedMedusaRequest,
  variantId: string,
  vendorId?: string
): Promise<string> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [variant],
  } = await query.graph({
    entity: "variant",
    fields: [
      "id",
      "title",
      "sku",
      "product.id",
      "product.title",
      "inventory_items.inventory_item_id",
    ],
    filters: { id: [variantId] },
  })

  if (!variant) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Variant not found.")
  }

  const existingItemId = (variant as any).inventory_items?.[0]?.inventory_item_id
  if (existingItemId) {
    const vId = vendorId ?? (await getVendorId(req))
    const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
    await remoteLink.create([
      {
        [MARKETPLACE_MODULE]: { vendor_id: vId },
        [Modules.INVENTORY]: { inventory_item_id: existingItemId },
      },
    ]).catch(() => {})
    return existingItemId
  }

  const itemTitle =
    variant.title &&
    variant.title !== "Default" &&
    variant.title !== "Default Variant"
      ? `${(variant as any).product?.title || "Product"} - ${variant.title}`
      : ((variant as any).product?.title || variant.title || "Variant Item")

  const { result } = await createInventoryItemsWorkflow(req.scope).run({
    input: {
      items: [
        {
          sku: variant.sku || undefined,
          title: itemTitle,
          requires_shipping: true,
        },
      ],
    },
  })

  const newItem = result[0]
  const vId = vendorId ?? (await getVendorId(req))
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  await remoteLink.create([
    {
      [MARKETPLACE_MODULE]: { vendor_id: vId },
      [Modules.INVENTORY]: { inventory_item_id: newItem.id },
    },
    {
      [Modules.PRODUCT]: { variant_id: variantId },
      [Modules.INVENTORY]: { inventory_item_id: newItem.id },
      data: { required_quantity: 1 },
    },
  ])

  return newItem.id
}

