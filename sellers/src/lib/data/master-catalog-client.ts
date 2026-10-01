import {
  type MasterCatalogSearchResponse,
  MasterCatalogSearchResponseSchema,
  type ProductFacetsResponse,
  ProductFacetsResponseSchema,
  type UnifiedMasterProduct,
  UnifiedMasterProductSchema,
} from "@typings/master-catalog"

const TRUSTCLAW_URL =
  process.env.NEXT_PUBLIC_TRUSTCLAW_API_URL ||
  "https://trustclaw-steel-phi.vercel.app"
const TRUSTCLAW_API_KEY =
  process.env.NEXT_PUBLIC_TRUSTCLAW_API_KEY || "dev_secret_key_123"

export class TrustClawError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message)
    this.name = "TrustClawError"
  }
}

export class TrustClawRateLimitError extends TrustClawError {
  constructor(message = "TrustClaw rate limit exceeded. Please retry shortly.") {
    super(message, 429, "RATE_LIMITED")
    this.name = "TrustClawRateLimitError"
  }
}

export class TrustClawNetworkError extends TrustClawError {
  constructor(message = "Unable to connect to TrustClaw Master Catalog.") {
    super(message, 0, "NETWORK_ERROR")
    this.name = "TrustClawNetworkError"
  }
}

export interface FetchOptions {
  timeoutMs?: number
  retries?: number
  backoffMs?: number
}

async function fetchWithRetry<T>(
  endpoint: string,
  schema: { parse: (data: unknown) => T },
  options: FetchOptions = {}
): Promise<T> {
  const { timeoutMs = 8000, retries = 2, backoffMs = 300 } = options
  const url = `${TRUSTCLAW_URL}${endpoint}`

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        headers: {
          "x-api-key": TRUSTCLAW_API_KEY,
          Accept: "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (res.status === 429) {
        if (attempt < retries) {
          const jitter = Math.random() * 200
          await new Promise((r) =>
            setTimeout(r, backoffMs * Math.pow(2, attempt) + jitter)
          )
          continue
        }
        throw new TrustClawRateLimitError()
      }

      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          await new Promise((r) =>
            setTimeout(r, backoffMs * Math.pow(2, attempt))
          )
          continue
        }
        const errJson = await res.json().catch(() => ({}))
        throw new TrustClawError(
          errJson.error || errJson.message || `TrustClaw returned HTTP ${res.status}`,
          res.status
        )
      }

      const json = await res.json()
      if (json.success === false) {
        throw new TrustClawError(json.error || json.message || "Request failed")
      }

      // TrustClaw wraps data in json.data
      const payload = json.data !== undefined ? json.data : json
      return schema.parse(payload)
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === "AbortError") {
        lastError = new TrustClawNetworkError(
          `Request timed out after ${timeoutMs}ms`
        )
      } else if (err instanceof TrustClawError) {
        lastError = err
      } else {
        lastError = new TrustClawNetworkError(err.message)
      }

      if (attempt >= retries) break
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)))
    }
  }

  throw lastError || new TrustClawNetworkError()
}

export interface MasterCatalogSearchParams {
  segmentCode?: string
  categoryId?: string
  vendorCategoryId?: string
  search?: string
  l1Category?: string
  l2Category?: string
  l3Category?: string
  brand?: string | string[]
  minPrice?: number
  maxPrice?: number
  status?: string
  sortBy?: "name" | "price" | "createdAt" | "brand"
  sortDir?: "asc" | "desc"
  page?: number
  cursor?: string | null
  limit?: number
}

export async function searchMasterProducts(
  params: MasterCatalogSearchParams,
  opts?: FetchOptions
): Promise<MasterCatalogSearchResponse> {
  const qs = new URLSearchParams()
  if (params.segmentCode) qs.set("segmentCode", params.segmentCode)
  if (params.categoryId) qs.set("categoryId", params.categoryId)
  if (params.vendorCategoryId) qs.set("vendorCategoryId", params.vendorCategoryId)
  if (params.search) qs.set("search", params.search)
  if (params.l1Category) qs.set("l1Category", params.l1Category)
  if (params.l2Category) qs.set("l2Category", params.l2Category)
  if (params.l3Category) qs.set("l3Category", params.l3Category)
  if (params.brand) {
    qs.set(
      "brand",
      Array.isArray(params.brand) ? params.brand.join(",") : params.brand
    )
  }
  if (params.minPrice !== undefined) qs.set("minPrice", String(params.minPrice))
  if (params.maxPrice !== undefined) qs.set("maxPrice", String(params.maxPrice))
  if (params.status) qs.set("status", params.status)
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortDir) qs.set("sortDir", params.sortDir)
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.cursor) qs.set("cursor", params.cursor)
  if (params.limit) qs.set("limit", String(params.limit))

  return fetchWithRetry(
    `/api/v1/products?${qs.toString()}`,
    MasterCatalogSearchResponseSchema,
    opts
  )
}

export interface MasterCatalogFacetsParams {
  segmentCode?: string
  categoryId?: string
  vendorCategoryId?: string
  l1Category?: string
  l2Category?: string
  brand?: string
  search?: string
}

export async function fetchMasterProductFacets(
  params: MasterCatalogFacetsParams,
  opts?: FetchOptions
): Promise<ProductFacetsResponse> {
  const qs = new URLSearchParams()
  if (params.segmentCode) qs.set("segmentCode", params.segmentCode)
  if (params.categoryId) qs.set("categoryId", params.categoryId)
  if (params.vendorCategoryId) qs.set("vendorCategoryId", params.vendorCategoryId)
  if (params.l1Category) qs.set("l1Category", params.l1Category)
  if (params.l2Category) qs.set("l2Category", params.l2Category)
  if (params.brand) qs.set("brand", params.brand)
  if (params.search) qs.set("search", params.search)

  return fetchWithRetry(
    `/api/v1/products/facets?${qs.toString()}`,
    ProductFacetsResponseSchema,
    opts
  )
}

export async function getMasterProductDetail(
  id: string,
  segmentCode?: string,
  opts?: FetchOptions
): Promise<UnifiedMasterProduct> {
  const qs = segmentCode
    ? `?segmentCode=${encodeURIComponent(segmentCode)}`
    : ""
  return fetchWithRetry(
    `/api/v1/products/${encodeURIComponent(id)}${qs}`,
    UnifiedMasterProductSchema,
    opts
  )
}

/**
 * Checks if the vendor already has this TrustClaw master product listed in their catalogue.
 */
export async function checkVendorProductExists(
  trustclawProductId: string
): Promise<{ exists: boolean; existingProduct?: { id: string; title: string } }> {
  try {
    const res = await fetch(
      `/api/vendors/products?limit=100`
    )
    if (!res.ok) return { exists: false }
    const json = await res.json()
    const products = json.products || []
    const match = products.find(
      (p: any) =>
        p.metadata?.trustclaw_product_id === trustclawProductId
    )
    if (match) {
      return { exists: true, existingProduct: { id: match.id, title: match.title } }
    }
    return { exists: false }
  } catch {
    return { exists: false }
  }
}
