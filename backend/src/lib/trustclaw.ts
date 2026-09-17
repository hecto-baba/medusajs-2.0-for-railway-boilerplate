/**
 * Lightweight TrustClaw taxonomy API client.
 *
 * Both the proxy routes (/vendors/taxonomy/segments,
 * /vendors/taxonomy/tc-categories) and the scheduled category-sync job
 * use this module so the base URL and auth header live in one place.
 *
 * Covers the full TrustClaw v1 surface:
 *   - Segments (business verticals)
 *   - Vendor Types (transaction modes: ORDER, BOOKING, RENTAL, …)
 *   - Vendor Categories (store classifications with P2V mapping)
 *   - Product Categories (L1/L2/L3 with advanced filtering)
 *   - Catalog Products (master product catalog)
 */

const BASE_URL =
  process.env.TRUSTCLAW_API_URL || "https://trustclaw-steel-phi.vercel.app"
const API_KEY = process.env.TRUSTCLAW_API_KEY || ""

export class TrustClawError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "TrustClawError"
  }
}

export interface TrustClawFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  params?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
}

async function trustclawFetch<T>(
  path: string,
  options: TrustClawFetchOptions | Record<string, string> = {}
): Promise<T> {
  let method: "GET" | "POST" | "PATCH" | "DELETE" = "GET"
  let params: Record<string, string | number | boolean | undefined | null> = {}
  let body: unknown = undefined

  if ("method" in options || "params" in options || "body" in options) {
    method = (options as TrustClawFetchOptions).method || "GET"
    params = (options as TrustClawFetchOptions).params || {}
    body = (options as TrustClawFetchOptions).body
  } else {
    params = options as Record<string, string>
  }

  const url = new URL(`${BASE_URL}${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v))
    }
  })

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Do not cache at the fetch layer — the proxy routes and job will
    // decide their own caching / revalidation strategy.
    cache: "no-store",
  })

  if (!res.ok) {
    let errorDetail = res.statusText
    try {
      const errJson = (await res.json()) as { error?: string; message?: string }
      if (errJson.error || errJson.message) {
        errorDetail = errJson.error || errJson.message || res.statusText
      }
    } catch {
      // ignore json parse failure on raw error responses
    }
    throw new TrustClawError(
      res.status,
      `TrustClaw API error ${res.status}: ${errorDetail}`
    )
  }

  const json = (await res.json()) as {
    success: boolean
    data: T
    error?: string
    message?: string
  }

  if (!json.success) {
    throw new TrustClawError(
      500,
      json.error ?? json.message ?? "TrustClaw returned success=false"
    )
  }

  return json.data
}

// ---------------------------------------------------------------------------
// Typed response shapes
// ---------------------------------------------------------------------------

export interface TrustClawSegment {
  id: string
  name: string
  code: string
  type: string
  orderType: string
  description: string | null
  sortOrder: number
  status: string
  isActive: boolean
  categoryCount: number
  vendorCategoryCount: number
}

export interface TrustClawCategory {
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
  status?: string
  isActive?: boolean
  segment?: { id: string; name: string; code: string }
  children?: TrustClawCategory[]
}

export interface TrustClawVendorType {
  id: string
  name: string
  code: string
  description: string | null
  sortOrder: number
  status: string
  isActive: boolean
  vendorCategoryCount: number
}

export interface TrustClawVendorCategory {
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
  onboardingMode: string
  vendorTypeId: string
  commissionPct: number
  commissionFlat: number
  status: string
  isActive: boolean
  segment: { id: string; name: string; code: string }
  vendorType: { id: string; name: string; code: string }
  children?: TrustClawVendorCategory[]
}

/** Product category allowed for a vendor category (P2V mapping). */
export interface TrustClawMappedCategory {
  id: string
  name: string
  code: string
  parentId: string | null
  level: number
  hasChildren: boolean
  sortOrder: number
  directProductCount: number
}

export interface TrustClawCatalogProduct {
  id: string
  name: string
  brand: string
  priceMin: number
  priceMax: number
  variantCount: number
  imageUrl: string
}

export interface TrustClawCatalogProductsResponse {
  items: TrustClawCatalogProduct[]
  nextCursor: string | null
}

// ---------------------------------------------------------------------------
// API helpers — Segments
// ---------------------------------------------------------------------------

/** Fetch all active segments (business verticals). */
export function fetchSegments(): Promise<TrustClawSegment[]> {
  return trustclawFetch<TrustClawSegment[]>("/api/v1/segments", {
    status: "ACTIVE",
  })
}

let cachedSegments: TrustClawSegment[] | null = null
let cachedVendorTypes: TrustClawVendorType[] | null = null
let cachedVendorCategories: TrustClawVendorCategory[] | null = null
let lastTaxonomyFetchTime = 0
const TAXONOMY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function resolveTaxonomyDetails(params: {
  segmentId?: string | null
  vendorTypeId?: string | null
  vendorCategoryId?: string | null
}): Promise<{
  segment?: { id: string; name: string; code: string } | null
  vendorType?: { id: string; name: string; code: string } | null
  vendorCategory?: { id: string; name: string; code: string } | null
}> {
  const now = Date.now()
  if (!cachedSegments || !cachedVendorTypes || !cachedVendorCategories || now - lastTaxonomyFetchTime > TAXONOMY_CACHE_TTL) {
    try {
      const [segs, vts, vcs] = await Promise.all([
        fetchSegments().catch(() => []),
        fetchVendorTypes({ status: "ALL" }).catch(() => []),
        fetchVendorCategories({ status: "ALL", limit: "500" }).catch(() => []),
      ])
      if (segs.length) cachedSegments = segs
      if (vts.length) cachedVendorTypes = vts
      if (vcs.length) cachedVendorCategories = vcs
      lastTaxonomyFetchTime = now
    } catch {
      // ignore
    }
  }

  let segment =
    cachedSegments?.find((s) => s.id === params.segmentId || s.code === params.segmentId) || null
  let vendorType =
    cachedVendorTypes?.find((vt) => vt.id === params.vendorTypeId || vt.code === params.vendorTypeId) || null
  let vendorCategory =
    cachedVendorCategories?.find((vc) => vc.id === params.vendorCategoryId || vc.code === params.vendorCategoryId) || null

  if (vendorCategory) {
    if (vendorCategory.segment) {
      segment = vendorCategory.segment as any
    }
    if (vendorCategory.vendorType) {
      vendorType = vendorCategory.vendorType as any
    }
  }

  return {
    segment: segment ? { id: segment.id, name: segment.name, code: segment.code } : null,
    vendorType: vendorType ? { id: vendorType.id, name: vendorType.name, code: vendorType.code } : null,
    vendorCategory: vendorCategory ? { id: vendorCategory.id, name: vendorCategory.name, code: vendorCategory.code } : null,
  }
}

// ---------------------------------------------------------------------------
// API helpers — Vendor Types
// ---------------------------------------------------------------------------

/**
 * Fetch vendor transaction types (ORDER, BOOKING, RENTAL, ENQUIRY, …).
 *
 * @param params.segmentCode       - Filter by segment (e.g. "HEALTHCARE")
 * @param params.segmentId         - Filter by segment UUID
 * @param params.status            - "ACTIVE" (default), "ALL", "DRAFT", "ARCHIVED"
 * @param params.isActive          - "true" / "false"
 * @param params.search            - Text search on name, code, description
 * @param params.includeCategories - "true" to embed child vendor categories
 * @param params.limit             - default "100", max "200"
 */
export function fetchVendorTypes(
  params: {
    segmentCode?: string
    segmentId?: string
    status?: string
    isActive?: string
    search?: string
    includeCategories?: string
    limit?: string
  } = {}
): Promise<TrustClawVendorType[]> {
  return trustclawFetch<TrustClawVendorType[]>("/api/v1/vendor-types", {
    ...(params.segmentCode ? { segmentCode: params.segmentCode } : {}),
    ...(params.segmentId ? { segmentId: params.segmentId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.isActive ? { isActive: params.isActive } : {}),
    ...(params.search ? { search: params.search } : {}),
    ...(params.includeCategories ? { includeCategories: params.includeCategories } : {}),
    limit: params.limit ?? "100",
  })
}

// ---------------------------------------------------------------------------
// API helpers — Vendor Categories
// ---------------------------------------------------------------------------

/**
 * Fetch vendor store classifications.
 *
 * @param params.segmentCode    - e.g. "AGRICULTURE", "HEALTHCARE"
 * @param params.segmentId      - Segment UUID
 * @param params.vendorTypeCode - e.g. "ORDER", "BOOKING", "RENTAL"
 * @param params.vendorTypeId   - Vendor type UUID
 * @param params.level          - Depth level ("1" for root, "2" for sub, "1,2")
 * @param params.parentId       - "null" or "root" for L1, or UUID for children
 * @param params.pathPrefix     - Materialized path prefix search
 * @param params.hasChildren    - "true" / "false"
 * @param params.onboardingMode - "COMMON" vs "SPECIALIZED"
 * @param params.search         - Search name or code
 * @param params.tree           - "true" for nested hierarchy
 * @param params.limit          - default "200", max "1000"
 */
export function fetchVendorCategories(
  params: {
    segmentCode?: string
    segmentId?: string
    vendorTypeCode?: string
    vendorTypeId?: string
    status?: string
    level?: string
    parentId?: string
    pathPrefix?: string
    hasChildren?: string
    onboardingMode?: string
    search?: string
    tree?: string
    limit?: string
  } = {}
): Promise<TrustClawVendorCategory[]> {
  const q: Record<string, string> = {}
  if (params.segmentCode) q.segmentCode = params.segmentCode
  if (params.segmentId) q.segmentId = params.segmentId
  if (params.vendorTypeCode) q.vendorTypeCode = params.vendorTypeCode
  if (params.vendorTypeId) q.vendorTypeId = params.vendorTypeId
  q.status = params.status ?? "ALL"
  if (params.level) q.level = params.level
  if (params.parentId !== undefined) q.parentId = params.parentId
  if (params.pathPrefix) q.pathPrefix = params.pathPrefix
  if (params.hasChildren) q.hasChildren = params.hasChildren
  if (params.onboardingMode) q.onboardingMode = params.onboardingMode
  if (params.search) q.search = params.search
  if (params.tree) q.tree = params.tree
  q.limit = params.limit ?? "200"

  return trustclawFetch<TrustClawVendorCategory[]>("/api/v1/vendor-categories", q)
}

/**
 * Fetch product categories mapped to a specific vendor category (P2V mapping).
 *
 * @param idOrCode - Vendor category UUID or code (e.g. "AGRI_INPUT_RETAIL")
 * @param params.parentId - Filter by parent ("null" for root)
 */
export function fetchVendorCategoryCategories(
  idOrCode: string,
  params: { parentId?: string } = {}
): Promise<TrustClawMappedCategory[]> {
  const q: Record<string, string> = {}
  if (params.parentId !== undefined) q.parentId = params.parentId

  return trustclawFetch<TrustClawMappedCategory[]>(
    `/api/v1/vendor-categories/${encodeURIComponent(idOrCode)}/categories`,
    q
  )
}

// ---------------------------------------------------------------------------
// API helpers — Product Categories (enhanced)
// ---------------------------------------------------------------------------

/**
 * Fetch product categories with advanced L1/L2/L3 filtering.
 *
 * @param params.segmentCode      - e.g. "AGRICULTURE"
 * @param params.segmentId        - Segment UUID
 * @param params.level            - Depth level ("1", "2", "3", or "1,2")
 * @param params.parentId         - "null" for root, or category UUID
 * @param params.pathPrefix       - Materialized path prefix (e.g. "/SEEDS")
 * @param params.hasChildren      - "true" for branches, "false" for leaf nodes
 * @param params.vendorCategoryId - Filter by vendor category P2V mapping
 * @param params.search           - Search category name or code
 * @param params.tree             - "true" for nested hierarchy
 * @param params.limit            - default "200", max "1000"
 */
export function fetchCategories(
  params: {
    segmentCode?: string
    segmentId?: string
    level?: string
    parentId?: string
    pathPrefix?: string
    hasChildren?: string
    vendorCategoryId?: string
    search?: string
    tree?: "true" | "false"
    limit?: string
  } = {}
): Promise<TrustClawCategory[]> {
  const q: Record<string, string> = {}
  if (params.segmentCode) q.segmentCode = params.segmentCode
  if (params.segmentId) q.segmentId = params.segmentId
  if (params.level) q.level = params.level
  if (params.parentId !== undefined) q.parentId = params.parentId
  if (params.pathPrefix) q.pathPrefix = params.pathPrefix
  if (params.hasChildren) q.hasChildren = params.hasChildren
  if (params.vendorCategoryId) q.vendorCategoryId = params.vendorCategoryId
  if (params.search) q.search = params.search
  if (params.tree) q.tree = params.tree
  q.limit = params.limit ?? "200"

  return trustclawFetch<TrustClawCategory[]>("/api/v1/categories", q)
}

// ---------------------------------------------------------------------------
// API helpers — Catalog Products
// ---------------------------------------------------------------------------

/**
 * Query master catalog products.
 *
 * @param params.segmentCode      - Business vertical code
 * @param params.segmentId        - Business vertical UUID
 * @param params.categoryId       - Product category UUID (subtree resolution)
 * @param params.vendorCategoryId - Scope to permitted vendor category
 * @param params.search           - Keyword search
 * @param params.cursor           - Pagination cursor
 * @param params.limit            - default "20", max "50"
 */
export function fetchCatalogProducts(
  params: {
    segmentCode?: string
    segmentId?: string
    categoryId?: string
    vendorCategoryId?: string
    search?: string
    cursor?: string
    limit?: string
  } = {}
): Promise<TrustClawCatalogProductsResponse> {
  const q: Record<string, string> = {}
  if (params.segmentCode) q.segmentCode = params.segmentCode
  if (params.segmentId) q.segmentId = params.segmentId
  if (params.categoryId) q.categoryId = params.categoryId
  if (params.vendorCategoryId) q.vendorCategoryId = params.vendorCategoryId
  if (params.search) q.search = params.search
  if (params.cursor) q.cursor = params.cursor
  q.limit = params.limit ?? "20"

  return trustclawFetch<TrustClawCatalogProductsResponse>("/api/v1/products", q)
}

// ---------------------------------------------------------------------------
// Typed response shapes — Onboarding & Question Engine
// ---------------------------------------------------------------------------

export type OnboardingStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"

export type OnboardingStepName =
  | "SEGMENT_SELECTION"
  | "IDENTITY"
  | "LOCATION"
  | "OPERATIONS"
  | "CONTACT"
  | "KYC"
  | "SHOWCASE"
  | "REVIEW"
  | "SUBMITTED"

export interface TrustClawOnboardingStatus {
  status: OnboardingStatus
  currentStep: OnboardingStepName | string
  completedSteps: (OnboardingStepName | string)[]
  vendorId?: string
  segmentId?: string | null
  vendorTypeId?: string | null
  vendorCategoryId?: string | null
  segment?: { id: string; name: string; code: string } | null
  vendorType?: { id: string; name: string; code: string } | null
  vendorCategory?: { id: string; name: string; code: string } | null
  rejectionReason?: string | null
  feedback?: string | null
  submittedAt?: string | null
  reviewedAt?: string | null
  canEdit?: boolean
}

export interface TrustClawQuestionOption {
  label: string
  value: string
  description?: string
}

export type TrustClawFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "SELECT"
  | "MULTI_SELECT"
  | "RADIO"
  | "FILE_UPLOAD"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "LOCATION_GEO"

export interface TrustClawQuestionField {
  id: string
  name: string
  label: string
  description?: string | null
  type: TrustClawFieldType
  placeholder?: string | null
  required: boolean
  options?: TrustClawQuestionOption[]
  validationRule?: string | null
  dependsOn?: { field: string; value: string | boolean } | null
  defaultValue?: unknown
}

export interface TrustClawQuestionSet {
  step: OnboardingStepName | string
  title: string
  description?: string | null
  fields: TrustClawQuestionField[]
}

export interface TrustClawSaveStepPayload {
  vendorId: string
  step: OnboardingStepName | string
  answers: Record<string, unknown>
  segmentId?: string
  vendorTypeId?: string
  vendorCategoryId?: string
}

export interface TrustClawSaveStepResult {
  success: boolean
  savedStep: string
  nextStep?: string
  completedSteps: string[]
}

export interface TrustClawSubmitPayload {
  vendorId: string
}

export interface TrustClawSubmitResult {
  success: boolean
  status: OnboardingStatus
  submittedAt: string
}

export interface TrustClawAnswersResponse {
  vendorId: string
  status: OnboardingStatus
  segmentId?: string | null
  vendorTypeId?: string | null
  vendorCategoryId?: string | null
  answers: Record<string, Record<string, unknown>>
  completedSteps: string[]
  rejectionReason?: string | null
  feedback?: string | null
}

// ---------------------------------------------------------------------------
// API helpers — Onboarding
// ---------------------------------------------------------------------------

/**
 * Fetch the onboarding application status for a vendor.
 */
export function fetchOnboardingStatus(
  vendorId: string
): Promise<TrustClawOnboardingStatus> {
  return trustclawFetch<TrustClawOnboardingStatus>("/api/v1/onboarding/status", {
    vendorId,
  })
}

/**
 * Fetch dynamic question sets for a vendor onboarding step / category.
 */
export function fetchOnboardingQuestions(
  params: {
    vendorCategoryId?: string
    step?: string
    segmentId?: string
    vendorTypeId?: string
  } = {}
): Promise<TrustClawQuestionSet[]> {
  const q: Record<string, string> = {}
  if (params.vendorCategoryId) q.vendorCategoryId = params.vendorCategoryId
  if (params.step) q.step = params.step
  if (params.segmentId) q.segmentId = params.segmentId
  if (params.vendorTypeId) q.vendorTypeId = params.vendorTypeId

  return trustclawFetch<TrustClawQuestionSet[]>(
    "/api/v1/onboarding/questions",
    q
  )
}

/**
 * Save draft or step answers for a vendor's onboarding application.
 */
export function saveOnboardingStep(
  payload: TrustClawSaveStepPayload
): Promise<TrustClawSaveStepResult> {
  return trustclawFetch<TrustClawSaveStepResult>(
    "/api/v1/onboarding/save-step",
    {
      method: "POST",
      body: payload,
    }
  )
}

/**
 * Submit the onboarding application for final review.
 */
export function submitOnboarding(
  vendorId: string
): Promise<TrustClawSubmitResult> {
  return trustclawFetch<TrustClawSubmitResult>("/api/v1/onboarding/submit", {
    method: "POST",
    body: { vendorId },
  })
}

/**
 * Fetch all previously saved onboarding answers for a vendor.
 */
export function fetchOnboardingAnswers(
  vendorId: string
): Promise<TrustClawAnswersResponse> {
  return trustclawFetch<TrustClawAnswersResponse>(
    "/api/v1/onboarding/answers",
    {
      vendorId,
    }
  )
}

// ---------------------------------------------------------------------------
// API helpers — Admin Application Review
// ---------------------------------------------------------------------------

export interface TrustClawAdminApplicationItem {
  id: string
  vendorId: string
  vendorName?: string
  email?: string
  status: OnboardingStatus
  currentStep: string
  completedSteps: string[]
  segment?: { id: string; name: string; code: string } | null
  vendorType?: { id: string; name: string; code: string } | null
  vendorCategory?: { id: string; name: string; code: string } | null
  rejectionReason?: string | null
  feedback?: string | null
  submittedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface TrustClawAdminApplicationsResponse {
  items: TrustClawAdminApplicationItem[]
  count: number
  limit: number
  offset: number
}

/**
 * Admin: list vendor onboarding applications.
 */
export function adminFetchApplications(
  params: {
    status?: string
    segmentId?: string
    vendorTypeId?: string
    search?: string
    limit?: string
    offset?: string
  } = {}
): Promise<TrustClawAdminApplicationsResponse> {
  const q: Record<string, string> = {}
  if (params.status) q.status = params.status
  if (params.segmentId) q.segmentId = params.segmentId
  if (params.vendorTypeId) q.vendorTypeId = params.vendorTypeId
  if (params.search) q.search = params.search
  if (params.limit) q.limit = params.limit
  if (params.offset) q.offset = params.offset

  return trustclawFetch<TrustClawAdminApplicationsResponse>(
    "/api/v1/admin/onboarding/applications",
    q
  )
}

/**
 * Admin: approve a vendor application.
 */
export function adminApproveApplication(
  vendorId: string
): Promise<{ success: boolean; status: OnboardingStatus; approvedAt: string }> {
  return trustclawFetch<{
    success: boolean
    status: OnboardingStatus
    approvedAt: string
  }>(
    `/api/v1/admin/onboarding/applications/${encodeURIComponent(vendorId)}/approve`,
    {
      method: "POST",
    }
  )
}

/**
 * Admin: reject or request revisions on a vendor application.
 */
export function adminRejectApplication(
  vendorId: string,
  reason: string
): Promise<{ success: boolean; status: OnboardingStatus; rejectedAt: string }> {
  return trustclawFetch<{
    success: boolean
    status: OnboardingStatus
    rejectedAt: string
  }>(
    `/api/v1/admin/onboarding/applications/${encodeURIComponent(vendorId)}/reject`,
    {
      method: "POST",
      body: { reason },
    }
  )
}


