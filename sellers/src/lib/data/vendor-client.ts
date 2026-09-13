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
  available_quantity: number
  stock_locations?: { id: string; name: string }[]
}

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
