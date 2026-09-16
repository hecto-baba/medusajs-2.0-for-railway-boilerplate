/**
 * Client-side reads of the vendor API.
 *
 * These go through the app's own /api/vendors proxy rather than to the backend
 * directly: the session token is httpOnly, so only the server can attach it.
 */
export type VendorProductImage = {
  id: string
  url: string
  rank?: number
}

export type VendorProductOptionValue = {
  id: string
  value: string
}

export type VendorProductOption = {
  id: string
  title: string
  values?: VendorProductOptionValue[]
}

export type VendorPrice = {
  id?: string
  currency_code: string
  amount: number
}

export type VendorVariant = {
  id: string
  title: string | null
  sku?: string | null
  barcode?: string | null
  ean?: string | null
  upc?: string | null
  manage_inventory?: boolean
  allow_backorder?: boolean
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  hs_code?: string | null
  mid_code?: string | null
  origin_country?: string | null
  material?: string | null
  options?: { id: string; value: string; option_id?: string }[]
  prices?: VendorPrice[]
  inventory_items?: {
    inventory_item_id: string
    required_quantity?: number
  }[]
}

export type VendorProduct = {
  subtitle?: string | null
  description?: string | null
  collection?: { id: string; title: string } | null
  categories?: { id: string; name: string }[]
  tags?: { id: string; value: string }[]
  type?: { id: string; value: string } | null
  sales_channels?: { id: string; name: string | null }[]
  shipping_profile?: { id: string; name: string } | null
  id: string
  title: string
  handle: string | null
  status: string
  thumbnail: string | null
  created_at: string
  updated_at: string
  // Attributes shown in the sidebar, mirroring the admin's Attributes card.
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  hs_code?: string | null
  mid_code?: string | null
  origin_country?: string | null
  material?: string | null
  discountable?: boolean
  metadata?: Record<string, unknown> | null
  images?: VendorProductImage[]
  options?: VendorProductOption[]
  variants?: VendorVariant[]
}

export type VendorOrder = {
  id: string
  display_id: number
  status: string
  created_at: string
  email: string | null
  currency_code: string
  total: number
  customer?: { email: string | null } | null
  sales_channel?: { name: string | null } | null
  payment_collections?: { status: string }[]
  fulfillments?: { id: string; delivered_at: string | null; shipped_at: string | null }[]
}

export type ListResponse<T> = {
  count: number
  limit: number
  offset: number
} & T

const request = async <T>(
  path: string,
  params: Record<string, string | number | string[] | undefined>
) => {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue
    }

    // Array values are appended once per entry rather than joined, so the
    // backend receives status=draft&status=published - the shape its schema
    // normalises. A comma-joined single value would fail the enum check.
    if (Array.isArray(value)) {
      value.forEach((entry) => search.append(key, String(entry)))
      continue
    }

    search.set(key, String(value))
  }

  const res = await fetch(`/api/vendors/${path}?${search.toString()}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as T
}

export const listVendorProducts = (params: {
  limit: number
  offset: number
  q?: string
  status?: string[]
  order?: string
}) => request<ListResponse<{ products: VendorProduct[] }>>("products", params)

/**
 * Starts a CSV export of the vendor's products.
 *
 * Returns a transaction id rather than a file: the backend generates the CSV
 * in the background and emails it when ready, which is how the admin behaves
 * too. A null id means the vendor has nothing to export.
 */
export const exportVendorProducts = () =>
  mutate<{ transaction_id: string | null; count?: number }>(
    "products/export",
    "POST",
    {}
  )

/**
 * Uploads a CSV and returns the stored file's key.
 *
 * Import is two steps on purpose, matching the admin: the file is uploaded and
 * parsed first so the vendor sees the create/update counts before anything is
 * written, and nothing is applied until confirmVendorProductImport runs.
 */
export const uploadVendorImportFile = async (file: File) => {
  const form = new FormData()
  form.append("files", file)

  const res = await fetch("/api/vendors/uploads", {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Upload failed with ${res.status}`)
  }

  const { files } = (await res.json()) as {
    files: { id: string; url: string }[]
  }

  return files[0]
}

export const startVendorProductImport = (params: {
  file_key: string
  originalname: string
  extension: string
  size: number
  mime_type: string
}) =>
  mutate<{
    transaction_id: string
    summary?: { toCreate: number; toUpdate: number }
  }>("products/imports", "POST", params)

export const confirmVendorProductImport = (transactionId: string) =>
  mutate<Record<string, never>>(
    "products/imports/" + transactionId + "/confirm",
    "POST",
    {}
  )

export const listVendorOrders = (params: { limit: number; offset: number }) =>
  request<ListResponse<{ orders: VendorOrder[] }>>("orders", params)

const mutate = async <T>(
  path: string,
  method: "POST" | "DELETE",
  body?: unknown
) => {
  const res = await fetch(`/api/vendors/${path}`, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as T
}

export const getVendorProduct = async (id: string) => {
  const res = await fetch(`/api/vendors/products/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { product: VendorProduct }
}

export const createVendorProduct = (body: Record<string, unknown>) =>
  mutate<{ product: VendorProduct }>("products", "POST", body)

export const updateVendorProduct = (id: string, body: Record<string, unknown>) =>
  mutate<{ product: VendorProduct }>(`products/${id}`, "POST", body)

export const deleteVendorProduct = (id: string) =>
  mutate<{ id: string; deleted: boolean }>(`products/${id}`, "DELETE")

/* ---------------------------------------------------------------- variants */

export const listVendorVariants = (productId: string) =>
  request<{ variants: VendorVariant[]; count: number }>(
    "products/" + productId + "/variants",
    {}
  )

export const createVendorVariant = (
  productId: string,
  body: Record<string, unknown>
) =>
  mutate<{ product: VendorProduct }>(
    "products/" + productId + "/variants",
    "POST",
    body
  )

export const updateVendorVariant = (
  productId: string,
  variantId: string,
  body: Record<string, unknown>
) =>
  mutate<{ product: VendorProduct }>(
    "products/" + productId + "/variants/" + variantId,
    "POST",
    body
  )

export const deleteVendorVariant = (productId: string, variantId: string) =>
  mutate<{ id: string; deleted: boolean }>(
    "products/" + productId + "/variants/" + variantId,
    "DELETE"
  )

/* ----------------------------------------------------------------- options */

export const listVendorOptions = (productId: string) =>
  request<{ product_options: VendorProductOption[]; count: number }>(
    "products/" + productId + "/options",
    {}
  )

/**
 * Creates, updates and removes options in one call.
 *
 * The envelope is add/remove/update rather than create/delete/update - the
 * shape Medusa's own validator expects for this route.
 */
export const batchVendorOptions = (
  productId: string,
  body: {
    add?: { title: string; values: string[] }[]
    update?: { id: string; title?: string; values?: string[] }[]
    remove?: string[]
  }
) =>
  mutate<{ product: VendorProduct }>(
    "products/" + productId + "/options/batch",
    "POST",
    body
  )

/* ------------------------------------------------------------------- media */

/**
 * Uploads image files and returns their public URLs.
 *
 * Separate from uploadVendorImportFile because that one returns a storage key
 * for the importer, whereas media needs the URL to attach to the product.
 */
export const uploadVendorImages = async (files: File[]) => {
  const form = new FormData()
  files.forEach((file) => form.append("files", file))

  const res = await fetch("/api/vendors/uploads", {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? "Upload failed with " + res.status)
  }

  const { files: uploaded } = (await res.json()) as {
    files: { id: string; url: string }[]
  }

  return uploaded
}

/* ------------------------------------------------------------------ rental */

export type VendorRentalConfig = {
  id: string
  product_id: string
  min_rental_days: number
  max_rental_days: number | null
  status: "active" | "inactive"
}

export const getVendorRentalConfig = (productId: string) =>
  request<{ rental_config: VendorRentalConfig | null }>(
    "products/" + productId + "/rental-config",
    {}
  )

export const upsertVendorRentalConfig = (
  productId: string,
  body: {
    min_rental_days?: number
    max_rental_days?: number | null
    status?: "active" | "inactive"
  }
) =>
  mutate<{ rental_config: VendorRentalConfig }>(
    "products/" + productId + "/rental-config",
    "POST",
    body
  )

/**
 * Replaces the product's metadata map.
 *
 * Metadata is replace-semantics on the product update, so callers send the
 * whole map back rather than a patch.
 */
export const updateVendorMetadata = (
  productId: string,
  metadata: Record<string, unknown>
) => updateVendorProduct(productId, { metadata })

/* ---------------------------------------------------------------- taxonomy */

export type VendorTaxonomy = {
  collections: { id: string; title: string }[]
  categories: { id: string; name: string }[]
  tags: { id: string; value: string }[]
  types: { id: string; value: string }[]
  sales_channels: { id: string; name: string }[]
  shipping_profiles: { id: string; name: string; type: string }[]
  currencies: { code: string; is_default: boolean }[]
  stock_locations: { id: string; name: string }[]
}

/**
 * The store's shared product taxonomy, for the Organize picker.
 *
 * Store-wide by design - see the route's own comment. Only ids and labels come
 * back, never the products filed under each.
 */
export const getVendorTaxonomy = () => request<VendorTaxonomy>("taxonomy", {})

/* --------------------------------------------------- TrustClaw taxonomy */

export type TrustClawSegment = {
  id: string
  name: string
  code: string
  type: string
  orderType?: string
  description: string | null
  sortOrder: number
  isActive: boolean
  categoryCount: number
  vendorCategoryCount?: number
}

export type TrustClawCategory = {
  id: string
  name: string
  code: string
  description: string | null
  level: number
  path: string
  parentId: string | null
  hasChildren: boolean
  childCount: number
  sortOrder: number
  segmentId: string
  segment?: { id: string; name: string; code: string }
  medusa_id?: string | null
  children?: TrustClawCategory[]
}

/**
 * Fetch all active TrustClaw business segments (e.g. Agriculture, Grocery).
 * Proxied through Medusa so the API key stays server-side.
 */
export const getTrustClawSegments = () =>
  request<{ segments: TrustClawSegment[] }>("taxonomy/segments", {}).then(
    (r) => r.segments
  )

export type TrustClawCategoryQueryParams = {
  segmentCode?: string
  segmentId?: string
  parentId?: string
  level?: string
  hasChildren?: string | boolean
  vendorCategoryId?: string
  pathPrefix?: string
  search?: string
  tree?: string | boolean
  limit?: string | number
}

/**
 * Fetch TrustClaw categories for a given segment or advanced filter criteria.
 */
export const getTrustClawCategories = (
  paramsOrSegmentCode: TrustClawCategoryQueryParams | string,
  parentId?: string
) => {
  const params: Record<string, string | number | undefined> =
    typeof paramsOrSegmentCode === "string"
      ? {
          segmentCode: paramsOrSegmentCode,
          ...(parentId !== undefined ? { parentId } : {}),
        }
      : {
          segmentCode: paramsOrSegmentCode.segmentCode,
          segmentId: paramsOrSegmentCode.segmentId,
          parentId: paramsOrSegmentCode.parentId,
          level: paramsOrSegmentCode.level,
          hasChildren:
            paramsOrSegmentCode.hasChildren !== undefined
              ? String(paramsOrSegmentCode.hasChildren)
              : undefined,
          vendorCategoryId: paramsOrSegmentCode.vendorCategoryId,
          pathPrefix: paramsOrSegmentCode.pathPrefix,
          search: paramsOrSegmentCode.search,
          tree:
            paramsOrSegmentCode.tree !== undefined
              ? String(paramsOrSegmentCode.tree)
              : undefined,
          limit: paramsOrSegmentCode.limit,
        }

  return request<{ categories: TrustClawCategory[] }>(
    "taxonomy/tc-categories",
    params
  ).then((r) => r.categories)
}

/* ---------------------------------------------------------- return reasons */

export type VendorReturnReason = {
  id: string
  value: string
  label: string
  description: string | null
  created_at: string
  updated_at: string
}

export const listVendorReturnReasons = (params: {
  limit: number
  offset: number
}) =>
  request<ListResponse<{ return_reasons: VendorReturnReason[] }>>(
    "return-reasons",
    params
  )

export const createVendorReturnReason = (body: {
  value: string
  label: string
  description?: string | null
}) => mutate<{ return_reason: VendorReturnReason }>("return-reasons", "POST", body)

export const updateVendorReturnReason = (
  id: string,
  body: { label?: string; description?: string | null }
) =>
  mutate<{ return_reason: VendorReturnReason }>(
    `return-reasons/${id}`,
    "POST",
    body
  )

export const deleteVendorReturnReason = (id: string) =>
  mutate<{ id: string; deleted: boolean }>(`return-reasons/${id}`, "DELETE")

/* ---------------------------------------------------------- refund reasons */

export type VendorRefundReason = {
  id: string
  label: string
  code: string
  created_at: string
  updated_at: string
}

export const listVendorRefundReasons = (params: {
  limit: number
  offset: number
}) =>
  request<ListResponse<{ refund_reasons: VendorRefundReason[] }>>(
    "refund-reasons",
    params
  )

export const createVendorRefundReason = (body: {
  label: string
  code: string
  description?: string | null
}) => mutate<{ refund_reason: VendorRefundReason }>("refund-reasons", "POST", body)

export const updateVendorRefundReason = (
  id: string,
  body: { label?: string; code?: string; description?: string | null }
) =>
  mutate<{ refund_reason: VendorRefundReason }>(
    `refund-reasons/${id}`,
    "POST",
    body
  )

export const deleteVendorRefundReason = (id: string) =>
  mutate<{ id: string; deleted: boolean }>(`refund-reasons/${id}`, "DELETE")

/* --------------------------------------------------------------- settings */

export type VendorMe = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  vendor?: {
    id: string
    name: string
    handle: string
    logo: string | null
  }
}

export const getVendorMe = () => request<{ vendor_admin: VendorMe }>("me", {})

/**
 * Updates the signed-in vendor's own profile and store details.
 *
 * PATCH rather than POST: the backend applies only the keys present, so a form
 * that edits one section leaves the other's columns untouched. mutate() speaks
 * POST and DELETE only, hence the inline fetch.
 */
export const updateVendorMe = async (body: {
  first_name?: string | null
  last_name?: string | null
  name?: string
  logo?: string | null
}) => {
  const res = await fetch("/api/vendors/me", {
    method: "PATCH",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { vendor_admin: VendorMe }
}

/* --------------------------------------------------------------- inventory */

export type VendorInventoryLevel = {
  id: string
  inventory_item_id: string
  location_id: string
  stocked_quantity: number
  reserved_quantity: number
  incoming_quantity?: number
  available_quantity: number
  stock_locations?: {
    id: string
    name: string
    address?: {
      city?: string | null
      country_code?: string | null
      address_1?: string | null
    } | null
  } | {
    id: string
    name: string
    address?: {
      city?: string | null
      country_code?: string | null
      address_1?: string | null
    } | null
  }[]
}

export type VendorInventoryItemVariant = {
  id: string
  title: string | null
  sku?: string | null
  product?: {
    id: string
    title: string
    thumbnail?: string | null
  } | null
  options?: { id: string; value: string }[]
}

export type VendorInventoryItem = {
  id: string
  sku: string | null
  title: string | null
  description: string | null
  hs_code: string | null
  mid_code: string | null
  origin_country: string | null
  material: string | null
  weight: number | null
  length: number | null
  height: number | null
  width: number | null
  requires_shipping: boolean
  thumbnail: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  stocked_quantity?: number
  reserved_quantity?: number
  location_levels?: VendorInventoryLevel[]
  variants?: VendorInventoryItemVariant[]
}

export type VendorReservation = {
  id: string
  inventory_item_id: string
  location_id: string
  quantity: number
  description: string | null
  line_item_id?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  inventory_item?: {
    id: string
    title: string | null
    sku: string | null
    thumbnail?: string | null
  } | null
}

export const listVendorInventoryItems = (params: {
  limit: number
  offset: number
  q?: string
  sku?: string[]
  origin_country?: string
  location_id?: string
  order?: string
}) =>
  request<ListResponse<{ inventory_items: VendorInventoryItem[] }>>(
    "inventory-items",
    params
  )

export const getVendorInventoryItem = async (id: string) => {
  const res = await fetch(`/api/vendors/inventory-items/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { inventory_item: VendorInventoryItem }
}

export const createVendorInventoryItem = (body: Record<string, unknown>) =>
  mutate<{ inventory_item: VendorInventoryItem }>(
    "inventory-items",
    "POST",
    body
  )

export const updateVendorInventoryItem = (
  id: string,
  body: Record<string, unknown>
) =>
  mutate<{ inventory_item: VendorInventoryItem }>(
    `inventory-items/${id}`,
    "POST",
    body
  )

export const deleteVendorInventoryItem = (id: string) =>
  mutate<{ id: string; deleted: boolean }>(
    `inventory-items/${id}`,
    "DELETE"
  )

export const listVendorItemLocationLevels = (itemId: string) =>
  request<{ inventory_levels: VendorInventoryLevel[] }>(
    `inventory-items/${itemId}/location-levels`,
    {}
  )

export const createVendorItemLocationLevel = (
  itemId: string,
  body: { location_id: string; stocked_quantity?: number; incoming_quantity?: number }
) =>
  mutate<{ inventory_item: VendorInventoryItem }>(
    `inventory-items/${itemId}/location-levels`,
    "POST",
    body
  )

export const updateVendorItemLocationLevel = (
  itemId: string,
  locationId: string,
  body: { stocked_quantity?: number; incoming_quantity?: number }
) =>
  mutate<{ inventory_item: VendorInventoryItem }>(
    `inventory-items/${itemId}/location-levels/${locationId}`,
    "POST",
    body
  )

export const deleteVendorItemLocationLevel = (
  itemId: string,
  locationId: string
) =>
  mutate<{ id: string; deleted: boolean }>(
    `inventory-items/${itemId}/location-levels/${locationId}`,
    "DELETE"
  )

export const batchVendorItemLocationLevels = (
  itemId: string,
  body: {
    create?: { location_id: string; stocked_quantity?: number; incoming_quantity?: number }[]
    update?: { id?: string; location_id: string; stocked_quantity?: number; incoming_quantity?: number }[]
    delete?: string[]
  }
) =>
  mutate<{ inventory_item: VendorInventoryItem }>(
    `inventory-items/${itemId}/location-levels/batch`,
    "POST",
    body
  )

export const batchVendorItemsLocationLevels = (body: {
  create?: { inventory_item_id: string; location_id: string; stocked_quantity?: number; incoming_quantity?: number }[]
  update?: { id?: string; inventory_item_id: string; location_id: string; stocked_quantity?: number; incoming_quantity?: number }[]
  delete?: string[]
}) =>
  mutate<{ success: boolean; created: number; updated: number; deleted: number }>(
    "inventory-items/location-levels/batch",
    "POST",
    body
  )

export const exportVendorInventoryItems = () =>
  mutate<{ csv: string; count: number }>("inventory-items/export", "POST", {})

/* ------------------------------------------------------------- reservations */

export const listVendorReservations = (params: {
  limit: number
  offset: number
  q?: string
  inventory_item_id?: string | string[]
  location_id?: string | string[]
  order?: string
}) =>
  request<ListResponse<{ reservations: VendorReservation[] }>>(
    "reservations",
    params
  )

export const getVendorReservation = async (id: string) => {
  const res = await fetch(`/api/vendors/reservations/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { reservation: VendorReservation }
}

export const createVendorReservation = (body: {
  inventory_item_id: string
  location_id: string
  quantity: number
  description?: string | null
  line_item_id?: string | null
  metadata?: Record<string, unknown> | null
}) =>
  mutate<{ reservation: VendorReservation }>("reservations", "POST", body)

export const updateVendorReservation = (
  id: string,
  body: {
    location_id?: string
    quantity?: number
    description?: string | null
    metadata?: Record<string, unknown> | null
  }
) =>
  mutate<{ reservation: VendorReservation }>(`reservations/${id}`, "POST", body)

export const deleteVendorReservation = (id: string) =>
  mutate<{ id: string; deleted: boolean }>(`reservations/${id}`, "DELETE")

export const listVendorInventoryLevels = (
  productId: string,
  variantId: string
) =>
  request<{ inventory_levels: VendorInventoryLevel[] }>(
    "products/" + productId + "/variants/" + variantId + "/inventory-levels",
    {}
  )

/**
 * Sets the stocked quantity at one location, creating the level if the variant
 * has never been stocked there. The route upserts, so callers do not need to
 * know whether a level row already exists.
 */
export const setVendorInventoryLevel = (
  productId: string,
  variantId: string,
  body: { location_id: string; stocked_quantity: number }
) =>
  mutate<{ inventory_levels: VendorInventoryLevel[] }>(
    "products/" + productId + "/variants/" + variantId + "/inventory-levels",
    "POST",
    body
  )

/** Attaches images to a variant, or removes them. */
export const setVendorVariantImages = (
  productId: string,
  variantId: string,
  body: { add?: string[]; remove?: string[] }
) =>
  mutate<{ added: unknown[]; removed: unknown[] }>(
    "products/" + productId + "/variants/" + variantId + "/images/batch",
    "POST",
    body
  )

/* --------------------------------------------------------------- promotions */

/**
 * A rule scoped to "product" - the only attribute a vendor can use. Every
 * value is one of the vendor's own product ids, enforced server-side.
 */
export type VendorPromotionRule = {
  id?: string
  attribute: "product"
  operator: "eq" | "in"
  values: string[]
}

export type VendorApplicationMethod = {
  value: number
  currency_code?: string | null
  type: "fixed" | "percentage"
  target_type: "order" | "shipping_methods" | "items"
  allocation?: "each" | "across" | "once"
  max_quantity?: number | null
  apply_to_quantity?: number | null
  buy_rules_min_quantity?: number | null
  target_rules?: VendorPromotionRule[]
  buy_rules?: VendorPromotionRule[]
}

export type VendorPromotion = {
  id: string
  code: string
  status: "draft" | "active" | "inactive"
  type: "standard" | "buyget"
  is_automatic?: boolean
  is_tax_inclusive?: boolean
  limit?: number | null
  used?: number
  created_at: string
  updated_at?: string
  application_method?: VendorApplicationMethod
  rules?: VendorPromotionRule[]
}

export const listVendorPromotions = (params: {
  limit: number
  offset: number
  q?: string
  status?: string[]
  order?: string
}) => request<ListResponse<{ promotions: VendorPromotion[] }>>("promotions", params)

export const getVendorPromotion = async (id: string) => {
  const res = await fetch(`/api/vendors/promotions/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { promotion: VendorPromotion }
}

export const createVendorPromotion = (body: Record<string, unknown>) =>
  mutate<{ promotion: VendorPromotion }>("promotions", "POST", body)

export const updateVendorPromotion = (
  id: string,
  body: Record<string, unknown>
) => mutate<{ promotion: VendorPromotion }>(`promotions/${id}`, "POST", body)

export const deleteVendorPromotion = (id: string) =>
  mutate<{ id: string; deleted: boolean }>(`promotions/${id}`, "DELETE")

/**
 * Replaces a promotion's target_rules or buy_rules in one call.
 *
 * The envelope is add/remove/update rather than create/delete/update -
 * matching batchVendorOptions, and the shape Medusa's own batch rule
 * validator expects.
 */
export const batchVendorPromotionRules = (
  promotionId: string,
  ruleType: "target-rules" | "buy-rules",
  body: {
    create?: { attribute: "product"; operator: "eq" | "in"; values: string[] }[]
    update?: { id: string; values?: string[] }[]
    delete?: string[]
  }
) =>
  mutate<{ created: unknown[]; updated: unknown[]; deleted: string[] }>(
    `promotions/${promotionId}/${ruleType}/batch`,
    "POST",
    body
  )

/* ---------------------------------------------------------------- campaigns */

export type VendorCampaignBudget = {
  type: "usage" | "spend"
  limit?: number | null
  currency_code?: string | null
}

export type VendorCampaign = {
  id: string
  name: string
  description?: string | null
  campaign_identifier: string
  starts_at?: string | null
  ends_at?: string | null
  created_at: string
  updated_at?: string
  budget?: VendorCampaignBudget | null
}

export const listVendorCampaigns = (params: {
  limit: number
  offset: number
  q?: string
}) => request<ListResponse<{ campaigns: VendorCampaign[] }>>("campaigns", params)

export const getVendorCampaign = async (id: string) => {
  const res = await fetch(`/api/vendors/campaigns/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { campaign: VendorCampaign }
}

export const createVendorCampaign = (body: Record<string, unknown>) =>
  mutate<{ campaign: VendorCampaign }>("campaigns", "POST", body)

export const updateVendorCampaign = (id: string, body: Record<string, unknown>) =>
  mutate<{ campaign: VendorCampaign }>(`campaigns/${id}`, "POST", body)

export const deleteVendorCampaign = (id: string) =>
  mutate<{ id: string; deleted: boolean }>(`campaigns/${id}`, "DELETE")

/* ---------------------------------------------------------------- customers */

export type VendorCustomerAddress = {
  id: string
  customer_id: string
  address_name?: string | null
  is_default_shipping?: boolean
  is_default_billing?: boolean
  company?: string | null
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  country_code?: string | null
  province?: string | null
  postal_code?: string | null
  phone?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export type VendorCustomerGroup = {
  id: string
  name: string
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
  customers_count?: number
  customers?: VendorCustomer[]
}

export type VendorCustomer = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  company_name?: string | null
  has_account?: boolean
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
  orders_count?: number
  orders?: {
    id: string
    display_id?: number
    status?: string
    payment_status?: string
    fulfillment_status?: string
    total?: number
    currency_code?: string
    created_at: string
  }[]
  addresses?: VendorCustomerAddress[]
  groups?: {
    id: string
    name: string
    created_at?: string
    updated_at?: string
    customers_count?: number
  }[]
}

export const listVendorCustomers = (params: {
  limit: number
  offset: number
  q?: string
  has_account?: boolean | string
  order?: string
}) => {
  const queryParams: Record<string, string | number | string[] | undefined> = {
    limit: params.limit,
    offset: params.offset,
    q: params.q,
    has_account:
      typeof params.has_account === "boolean"
        ? String(params.has_account)
        : params.has_account,
    order: params.order,
  }
  return request<ListResponse<{ customers: VendorCustomer[] }>>(
    "customers",
    queryParams
  )
}

export const getVendorCustomer = async (id: string) => {
  const res = await fetch(`/api/vendors/customers/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { customer: VendorCustomer }
}

export const createVendorCustomer = (body: Record<string, unknown>) =>
  mutate<{ customer: VendorCustomer }>("customers", "POST", body)

export const updateVendorCustomer = (
  id: string,
  body: Record<string, unknown>
) => mutate<{ customer: VendorCustomer }>(`customers/${id}`, "POST", body)

export const deleteVendorCustomer = (id: string) =>
  mutate<{ id: string; object: "customer"; deleted: boolean }>(
    `customers/${id}`,
    "DELETE"
  )

export const batchVendorCustomerGroups = (
  customerId: string,
  body: { add?: string[]; remove?: string[] }
) =>
  mutate<{ customer: VendorCustomer }>(
    `customers/${customerId}/customer-groups`,
    "POST",
    body
  )

export const listVendorCustomerAddresses = async (customerId: string) => {
  const res = await fetch(`/api/vendors/customers/${customerId}/addresses`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { addresses: VendorCustomerAddress[]; count: number }
}

export const createVendorCustomerAddress = (
  customerId: string,
  body: Record<string, unknown>
) =>
  mutate<{ customer: VendorCustomer }>(
    `customers/${customerId}/addresses`,
    "POST",
    body
  )

export const updateVendorCustomerAddress = (
  customerId: string,
  addressId: string,
  body: Record<string, unknown>
) =>
  mutate<{ customer: VendorCustomer }>(
    `customers/${customerId}/addresses/${addressId}`,
    "POST",
    body
  )

export const deleteVendorCustomerAddress = (
  customerId: string,
  addressId: string
) =>
  mutate<{
    id: string
    object: "customer_address"
    deleted: boolean
    parent?: VendorCustomer
  }>(`customers/${customerId}/addresses/${addressId}`, "DELETE")

/* --------------------------------------------------------- customer-groups */

export const listVendorCustomerGroups = (params: {
  limit: number
  offset: number
  q?: string
  order?: string
}) =>
  request<ListResponse<{ customer_groups: VendorCustomerGroup[] }>>(
    "customer-groups",
    params
  )

export const getVendorCustomerGroup = async (id: string) => {
  const res = await fetch(`/api/vendors/customer-groups/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { customer_group: VendorCustomerGroup }
}

export const createVendorCustomerGroup = (body: Record<string, unknown>) =>
  mutate<{ customer_group: VendorCustomerGroup }>("customer-groups", "POST", body)

export const updateVendorCustomerGroup = (
  id: string,
  body: Record<string, unknown>
) =>
  mutate<{ customer_group: VendorCustomerGroup }>(
    `customer-groups/${id}`,
    "POST",
    body
  )

export const deleteVendorCustomerGroup = (id: string) =>
  mutate<{ id: string; object: "customer_group"; deleted: boolean }>(
    `customer-groups/${id}`,
    "DELETE"
  )

export const batchVendorCustomerGroupMembers = (
  groupId: string,
  body: { add?: string[]; remove?: string[] }
) =>
  mutate<{ customer_group: VendorCustomerGroup }>(
    `customer-groups/${groupId}/customers/batch`,
    "POST",
    body
  )

/* --------------------------------------------------------------- price-lists */

export type VendorPriceListType = "sale" | "override"
export type VendorPriceListStatus = "active" | "draft"

export type VendorPriceListPrice = {
  id?: string
  variant_id?: string
  currency_code: string
  amount: number
  min_quantity?: number | null
  max_quantity?: number | null
  rules?: Record<string, string>
}

export type VendorPriceListVariant = {
  id: string
  title: string | null
  sku?: string | null
  prices: VendorPriceListPrice[]
}

export type VendorPriceListProduct = {
  id: string
  title: string
  thumbnail?: string | null
  variants: VendorPriceListVariant[]
}

export type VendorPriceList = {
  id: string
  title: string
  description?: string | null
  type: VendorPriceListType
  status: VendorPriceListStatus
  starts_at?: string | null
  ends_at?: string | null
  rules?: Record<string, string[]> | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
  products_count?: number
  prices_count?: number
  products?: VendorPriceListProduct[]
}

export const listVendorPriceLists = (params: {
  limit: number
  offset: number
  q?: string
  status?: string | string[]
  type?: string | string[]
  order?: string
}) =>
  request<ListResponse<{ price_lists: VendorPriceList[] }>>(
    "price-lists",
    params as Record<string, string | number | string[] | undefined>
  )

export const getVendorPriceList = async (id: string) => {
  const res = await fetch(`/api/vendors/price-lists/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { price_list: VendorPriceList }
}

export const createVendorPriceList = (body: Record<string, unknown>) =>
  mutate<{ price_list: VendorPriceList }>("price-lists", "POST", body)

export const updateVendorPriceList = (
  id: string,
  body: Record<string, unknown>
) => mutate<{ price_list: VendorPriceList }>(`price-lists/${id}`, "POST", body)

export const deleteVendorPriceList = (id: string) =>
  mutate<{ id: string; object: "price_list"; deleted: boolean }>(
    `price-lists/${id}`,
    "DELETE"
  )

export const batchVendorPriceListPrices = (
  id: string,
  body: {
    create?: VendorPriceListPrice[]
    update?: VendorPriceListPrice[]
    delete?: string[]
  }
) =>
  mutate<{ price_list: VendorPriceList }>(
    `price-lists/${id}/prices/batch`,
    "POST",
    body
  )

export const removeProductsFromPriceList = (
  id: string,
  productIds: string[]
) =>
  mutate<{ price_list: VendorPriceList }>(
    `price-lists/${id}/products`,
    "POST",
    { remove: productIds }
  )

/* ------------------------------------------------------------------- venues */

export type VendorRowType = "vip" | "premium" | "balcony" | "standard"

export type VendorVenueRow = {
  id?: string
  venue_id?: string
  row_number: string
  row_type: VendorRowType
  seat_count: number
}

export type VendorVenue = {
  id: string
  name: string
  address?: string | null
  rows_count?: number
  total_seats?: number
  tiers?: VendorRowType[]
  rows: VendorVenueRow[]
  shows?: {
    id: string
    product_id: string
    dates: string[]
    product?: { title: string; thumbnail?: string | null }
  }[]
  created_at: string
  updated_at?: string
}

export const listVendorVenues = (params: {
  limit: number
  offset: number
  q?: string
  order?: string
}) =>
  request<ListResponse<{ venues: VendorVenue[] }>>(
    "venues",
    params as Record<string, string | number | undefined>
  )

export const getVendorVenue = async (id: string) => {
  const res = await fetch(`/api/vendors/venues/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.message || "Failed to fetch venue")
  }
  return (await res.json()) as { venue: VendorVenue }
}

export const createVendorVenue = (body: {
  name: string
  address?: string
  rows: {
    row_number: string
    row_type: VendorRowType
    seat_count: number
  }[]
}) => mutate<{ venue: VendorVenue }>("venues", "POST", body)

export const updateVendorVenue = (
  id: string,
  body: {
    name?: string
    address?: string | null
    rows?: {
      id?: string
      row_number: string
      row_type: VendorRowType
      seat_count: number
    }[]
  }
) => mutate<{ venue: VendorVenue }>(`venues/${id}`, "POST", body)

export const deleteVendorVenue = (id: string) =>
  mutate<{ id: string; object: "venue"; deleted: boolean }>(
    `venues/${id}`,
    "DELETE"
  )

/* -------------------------------------------------------------------- shows */

export type VendorShowVariant = {
  id: string
  row_type: VendorRowType
  product_variant_id: string
}

export type VendorTicketPurchase = {
  id: string
  order_id: string
  seat_number: string
  show_date: string
  status: "pending" | "scanned"
  venue_row?: {
    id: string
    row_number: string
    row_type: VendorRowType
  }
}

export type VendorShowPerformance = {
  date: string
  capacity: number
  sold_count: number
  available_count: number
  scanned_count: number
}

export type VendorShow = {
  id: string
  product_id: string
  venue_id: string
  dates: string[]
  dates_count?: number
  venue_capacity?: number
  tiers?: VendorRowType[]
  venue?: Pick<VendorVenue, "id" | "name" | "address"> & { rows?: VendorVenueRow[] }
  product?: {
    id: string
    title: string
    description?: string | null
    thumbnail?: string | null
    status?: string
    variants?: {
      id: string
      title?: string
      prices?: { currency_code: string; amount: number }[]
    }[]
  }
  variants?: VendorShowVariant[]
  performances?: VendorShowPerformance[]
  purchases?: VendorTicketPurchase[]
  created_at: string
  updated_at?: string
}

export type VendorSeatMapSeat = {
  seat_number: string
  is_available: boolean
  purchase_id?: string | null
  order_id?: string | null
  status?: "pending" | "scanned" | null
}

export type VendorSeatMapRow = {
  venue_row_id: string
  row_number: string
  row_type: VendorRowType
  seat_count: number
  seats: VendorSeatMapSeat[]
}

export type VendorSeatMapResponse = {
  date: string
  venue: Pick<VendorVenue, "id" | "name" | "address">
  seat_map: VendorSeatMapRow[]
}

export const listVendorShows = (params: {
  limit: number
  offset: number
  q?: string
  order?: string
}) =>
  request<ListResponse<{ shows: VendorShow[] }>>(
    "shows",
    params as Record<string, string | number | undefined>
  )

export const getVendorShow = async (id: string) => {
  const res = await fetch(`/api/vendors/shows/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.message || "Failed to fetch show")
  }
  return (await res.json()) as { show: VendorShow }
}

export const createVendorShow = (body: {
  name: string
  description?: string
  venue_id: string
  dates: string[]
  variants: {
    row_type: VendorRowType
    seat_count: number
    prices: {
      currency_code: string
      amount: number
      min_quantity?: number
      max_quantity?: number
    }[]
  }[]
}) => mutate<{ show: VendorShow }>("shows", "POST", body)

export const deleteVendorShow = (id: string) =>
  mutate<{ id: string; object: "show"; deleted: boolean }>(
    `shows/${id}`,
    "DELETE"
  )

export const getVendorShowSeats = async (id: string, date: string) => {
  const res = await fetch(
    `/api/vendors/shows/${id}/seats?date=${encodeURIComponent(date)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  )
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.message || "Failed to fetch show seats")
  }
  return (await res.json()) as VendorSeatMapResponse
}

export const scanVendorTicketPurchase = (
  showId: string,
  purchaseId: string
) =>
  mutate<{ purchase: VendorTicketPurchase; message: string }>(
    `shows/${showId}/purchases/${purchaseId}/scan`,
    "POST",
    {}
  )

/* ------------------------------------------------------------- collections */

export type VendorCollection = {
  id: string
  title: string
  handle: string
  metadata?: Record<string, unknown> | null
  products_count?: number
  products?: VendorProduct[]
  created_at: string
  updated_at?: string
}

export const listVendorCollections = (params: {
  limit: number
  offset: number
  q?: string
  order?: string
}) =>
  request<ListResponse<{ collections: VendorCollection[] }>>(
    "collections",
    params as Record<string, string | number | undefined>
  )

export const getVendorCollection = async (id: string) => {
  const res = await fetch(`/api/vendors/collections/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { collection: VendorCollection }
}

export const createVendorCollection = (body: {
  title: string
  handle?: string
  metadata?: Record<string, unknown>
}) => mutate<{ collection: VendorCollection }>("collections", "POST", body)

export const updateVendorCollection = (
  id: string,
  body: {
    title?: string
    handle?: string
    metadata?: Record<string, unknown>
  }
) => mutate<{ collection: VendorCollection }>(`collections/${id}`, "POST", body)

export const deleteVendorCollection = (id: string) =>
  mutate<{ id: string; object: "collection"; deleted: boolean }>(
    `collections/${id}`,
    "DELETE"
  )

export const manageVendorCollectionProducts = (
  id: string,
  body: {
    add?: string[]
    remove?: string[]
  }
) =>
  mutate<{ success: boolean; updated: number }>(
    `collections/${id}/products`,
    "POST",
    body
  )

/* -------------------------------------------------------------- categories */

export type VendorCategory = {
  id: string
  name: string
  handle: string
  description?: string | null
  is_active?: boolean
  is_internal?: boolean
  rank?: number
  parent_category_id?: string | null
  parent_category?: { id: string; name: string } | null
  category_children?: { id: string; name: string; handle?: string }[]
  products_count?: number
  is_vendor_owned?: boolean
  products?: VendorProduct[]
  created_at: string
  updated_at?: string
}

export const listVendorCategories = (params: {
  limit: number
  offset: number
  q?: string
  parent_category_id?: string | null
  order?: string
}) =>
  request<ListResponse<{ categories: VendorCategory[] }>>(
    "categories",
    params as Record<string, string | number | undefined>
  )

export const getVendorCategory = async (id: string) => {
  const res = await fetch(`/api/vendors/categories/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { category: VendorCategory }
}

export const createVendorCategory = (body: {
  name: string
  handle?: string
  description?: string
  is_active?: boolean
  is_internal?: boolean
  parent_category_id?: string | null
  metadata?: Record<string, unknown>
}) => mutate<{ category: VendorCategory }>("categories", "POST", body)

export const updateVendorCategory = (
  id: string,
  body: {
    name?: string
    handle?: string
    description?: string
    is_active?: boolean
    is_internal?: boolean
    parent_category_id?: string | null
    metadata?: Record<string, unknown>
  }
) => mutate<{ category: VendorCategory }>(`categories/${id}`, "POST", body)

export const deleteVendorCategory = (id: string) =>
  mutate<{ id: string; object: "product_category"; deleted: boolean }>(
    `categories/${id}`,
    "DELETE"
  )

export const manageVendorCategoryProducts = (
  id: string,
  body: {
    add?: string[]
    remove?: string[]
  }
) =>
  mutate<{ success: boolean; added: number; removed: number }>(
    `categories/${id}/products`,
    "POST",
    body
  )

/* --------------------------------------------------------- product options */

export type VendorProductOptionItem = {
  id: string
  title: string
  product_id?: string | null
  product?: {
    id: string
    title: string
    thumbnail?: string | null
  } | null
  values?: { id: string; value: string }[]
  created_at: string
  updated_at?: string
}

export const listVendorProductOptions = (params: {
  limit: number
  offset: number
  q?: string
  product_id?: string
  order?: string
}) =>
  request<ListResponse<{ product_options: VendorProductOptionItem[] }>>(
    "product-options",
    params as Record<string, string | number | undefined>
  )

export const getVendorProductOption = async (id: string) => {
  const res = await fetch(`/api/vendors/product-options/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { product_option: VendorProductOptionItem }
}

export const createVendorProductOption = (body: {
  title: string
  values?: string[]
  product_id?: string
}) =>
  mutate<{ product_option: VendorProductOptionItem }>(
    "product-options",
    "POST",
    body
  )

export const updateVendorProductOption = (
  id: string,
  body: {
    title?: string
    values?: string[]
  }
) =>
  mutate<{ product_option: VendorProductOptionItem }>(
    `product-options/${id}`,
    "POST",
    body
  )

export const deleteVendorProductOption = (id: string) =>
  mutate<{ id: string; object: "product_option"; deleted: boolean }>(
    `product-options/${id}`,
    "DELETE"
  )

/* ------------------------------------------------------------ draft orders */

export type VendorDraftOrder = {
  id: string
  display_id: number
  status: string
  is_draft_order: boolean
  email?: string | null
  currency_code: string
  total: number
  subtotal: number
  shipping_total: number
  tax_total: number
  discount_total: number
  customer?: {
    id: string
    first_name?: string | null
    last_name?: string | null
    email: string
  } | null
  shipping_address?: Record<string, any> | null
  billing_address?: Record<string, any> | null
  items?: any[]
  shipping_methods?: any[]
  summary?: any
  created_at: string
  updated_at?: string
}

export const listVendorDraftOrders = (params: {
  limit: number
  offset: number
  q?: string
  order?: string
}) =>
  request<ListResponse<{ draft_orders: VendorDraftOrder[] }>>(
    "draft-orders",
    params as Record<string, string | number | undefined>
  )

export const getVendorDraftOrder = async (id: string) => {
  const res = await fetch(`/api/vendors/draft-orders/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { draft_order: VendorDraftOrder }
}

export const createVendorDraftOrder = (body: Record<string, unknown>) =>
  mutate<{ draft_order: VendorDraftOrder }>("draft-orders", "POST", body)

export const convertVendorDraftOrder = (id: string) =>
  mutate<{ order: any }>(`draft-orders/${id}/convert`, "POST", {})

export const deleteVendorDraftOrder = (id: string) =>
  mutate<{ id: string; object: "draft_order"; deleted: boolean }>(
    `draft-orders/${id}`,
    "DELETE"
  )

/* ------------------------------------------------------------------- team */

export type VendorTeamMember = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  created_at: string
  updated_at?: string
}

export const listVendorTeam = (params: {
  limit: number
  offset: number
  q?: string
}) =>
  request<ListResponse<{ members: VendorTeamMember[] }>>(
    "team",
    params as Record<string, string | number | undefined>
  )

export const getVendorTeamMember = async (id: string) => {
  const res = await fetch(`/api/vendors/team/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { member: VendorTeamMember }
}

export const inviteVendorMember = (body: {
  email: string
  first_name?: string
  last_name?: string
}) => mutate<{ member: VendorTeamMember }>("team", "POST", body)

export const updateVendorMember = (
  id: string,
  body: {
    first_name?: string
    last_name?: string
  }
) => mutate<{ member: VendorTeamMember }>(`team/${id}`, "POST", body)

export const deleteVendorMember = (id: string) =>
  mutate<{ id: string; object: "vendor_admin"; deleted: boolean }>(
    `team/${id}`,
    "DELETE"
  )

/* -------------------------------------------------------- stock locations */

export type VendorStockLocation = {
  id: string
  name: string
  address?: {
    id?: string
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    country_code?: string | null
    postal_code?: string | null
    province?: string | null
    phone?: string | null
    company?: string | null
  } | null
  fulfillment_sets?: any[]
  fulfillment_providers?: any[]
  sales_channels?: any[]
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

export const listVendorStockLocations = (params: {
  limit: number
  offset: number
  q?: string
}) =>
  request<ListResponse<{ stock_locations: VendorStockLocation[] }>>(
    "stock-locations",
    params as Record<string, string | number | undefined>
  )

export const getVendorStockLocation = async (id: string) => {
  const res = await fetch(`/api/vendors/stock-locations/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { stock_location: VendorStockLocation }
}

export const createVendorStockLocation = (body: {
  name: string
  address?: {
    address_1?: string
    address_2?: string
    city?: string
    country_code: string
    postal_code?: string
    province?: string
    phone?: string
    company?: string
  }
  metadata?: Record<string, unknown>
}) =>
  mutate<{ stock_location: VendorStockLocation }>(
    "stock-locations",
    "POST",
    body
  )

export const updateVendorStockLocation = (
  id: string,
  body: {
    name?: string
    address?: Record<string, any>
    metadata?: Record<string, unknown>
  }
) =>
  mutate<{ stock_location: VendorStockLocation }>(
    `stock-locations/${id}`,
    "POST",
    body
  )

export const deleteVendorStockLocation = (id: string) =>
  mutate<{ id: string; object: "stock_location"; deleted: boolean }>(
    `stock-locations/${id}`,
    "DELETE"
  )

/* ------------------------------------------------------ shipping profiles */

export type VendorShippingProfile = {
  id: string
  name: string
  type: string
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

export const listVendorShippingProfiles = () =>
  request<{ shipping_profiles: VendorShippingProfile[] }>(
    "shipping-profiles",
    {}
  )

export const createVendorShippingProfile = (body: {
  name: string
  type?: string
  metadata?: Record<string, unknown>
}) =>
  mutate<{ shipping_profile: VendorShippingProfile }>(
    "shipping-profiles",
    "POST",
    body
  )

/* --------------------------------------------------------- sales channels */

export type VendorSalesChannel = {
  id: string
  name: string
  description?: string | null
  is_disabled: boolean
  products_count?: number
  is_vendor_owned?: boolean
  products?: VendorProduct[]
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

export const listVendorSalesChannels = (params: {
  limit: number
  offset: number
  q?: string
}) =>
  request<ListResponse<{ sales_channels: VendorSalesChannel[] }>>(
    "sales-channels",
    params as Record<string, string | number | undefined>
  )

export const getVendorSalesChannel = async (id: string) => {
  const res = await fetch(`/api/vendors/sales-channels/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { sales_channel: VendorSalesChannel }
}

export const createVendorSalesChannel = (body: {
  name: string
  description?: string
  is_disabled?: boolean
  metadata?: Record<string, unknown>
}) =>
  mutate<{ sales_channel: VendorSalesChannel }>(
    "sales-channels",
    "POST",
    body
  )

export const updateVendorSalesChannel = (
  id: string,
  body: {
    name?: string
    description?: string
    is_disabled?: boolean
    metadata?: Record<string, unknown>
  }
) =>
  mutate<{ sales_channel: VendorSalesChannel }>(
    `sales-channels/${id}`,
    "POST",
    body
  )

export const deleteVendorSalesChannel = (id: string) =>
  mutate<{ id: string; object: "sales_channel"; deleted: boolean }>(
    `sales-channels/${id}`,
    "DELETE"
  )

export const manageVendorSalesChannelProducts = (
  id: string,
  body: {
    add?: string[]
    remove?: string[]
  }
) =>
  mutate<{ success: boolean; added: number; removed: number }>(
    `sales-channels/${id}/products`,
    "POST",
    body
  )

/* ---------------------------------------------------------- product types */

export type VendorProductTypeItem = {
  id: string
  value: string
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

export const listVendorProductTypes = (params: {
  limit: number
  offset: number
  q?: string
}) =>
  request<ListResponse<{ product_types: VendorProductTypeItem[] }>>(
    "product-types",
    params as Record<string, string | number | undefined>
  )

export const createVendorProductType = (body: {
  value: string
  metadata?: Record<string, unknown>
}) =>
  mutate<{ product_type: VendorProductTypeItem }>(
    "product-types",
    "POST",
    body
  )

export const updateVendorProductType = (
  id: string,
  body: {
    value?: string
    metadata?: Record<string, unknown>
  }
) =>
  mutate<{ product_type: VendorProductTypeItem }>(
    `product-types/${id}`,
    "POST",
    body
  )

export const deleteVendorProductType = (id: string) =>
  mutate<{ id: string; object: "product_type"; deleted: boolean }>(
    `product-types/${id}`,
    "DELETE"
  )

/* ----------------------------------------------------------- product tags */

export type VendorProductTagItem = {
  id: string
  value: string
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

export const listVendorProductTags = (params: {
  limit: number
  offset: number
  q?: string
}) =>
  request<ListResponse<{ product_tags: VendorProductTagItem[] }>>(
    "product-tags",
    params as Record<string, string | number | undefined>
  )

export const createVendorProductTag = (body: {
  value: string
  metadata?: Record<string, unknown>
}) =>
  mutate<{ product_tag: VendorProductTagItem }>("product-tags", "POST", body)

export const updateVendorProductTag = (
  id: string,
  body: {
    value?: string
    metadata?: Record<string, unknown>
  }
) =>
  mutate<{ product_tag: VendorProductTagItem }>(
    `product-tags/${id}`,
    "POST",
    body
  )

export const deleteVendorProductTag = (id: string) =>
  mutate<{ id: string; object: "product_tag"; deleted: boolean }>(
    `product-tags/${id}`,
    "DELETE"
  )

/* --------------------------------------------------------------- api keys */

export type VendorApiKey = {
  id: string
  title: string
  type: "publishable" | "secret"
  token: string
  redacted: string
  created_at: string
  updated_at?: string
  revoked_at?: string | null
}

export const listVendorApiKeys = (params: {
  limit: number
  offset: number
  type?: "publishable" | "secret"
  q?: string
}) =>
  request<ListResponse<{ api_keys: VendorApiKey[] }>>(
    "api-keys",
    params as Record<string, string | number | undefined>
  )

export const createVendorApiKey = (body: {
  title: string
  type: "publishable" | "secret"
}) => mutate<{ api_key: VendorApiKey }>("api-keys", "POST", body)

export const updateVendorApiKey = (
  id: string,
  body: {
    title?: string
  }
) => mutate<{ api_key: VendorApiKey }>(`api-keys/${id}`, "POST", body)

export const revokeVendorApiKey = (id: string) =>
  mutate<{ api_key: VendorApiKey }>(`api-keys/${id}/revoke`, "POST", {})

export const deleteVendorApiKey = (id: string) =>
  mutate<{ id: string; object: "api_key"; deleted: boolean }>(
    `api-keys/${id}`,
    "DELETE"
  )

/* ---------------------------------------------------------------- regions */

export type VendorRegion = {
  id: string
  name: string
  currency_code: string
  countries?: { iso_2: string; display_name: string }[]
  payment_providers?: { id: string }[]
  created_at: string
  updated_at?: string
}

export const listVendorRegions = () =>
  request<{ regions: VendorRegion[] }>("regions", {})

/* ---------------------------------------------------------------- search */

export type VendorSearchResultGroup = {
  entity: string
  count: number
  data: any[]
}

export type VendorSearchResponse = {
  results: VendorSearchResultGroup[]
}

export const searchVendor = (params: {
  q?: string
  limit?: number
  entity?: string | string[]
}) => request<VendorSearchResponse>("search", params)




