/**
 * Shared TrustClaw types for Admin UI components.
 *
 * These mirror the shapes returned by the backend proxy routes
 * (/admin/taxonomy/*), which in turn mirror the TrustClaw REST API.
 */

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export type TrustClawSegment = {
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

// ---------------------------------------------------------------------------
// Product Categories (L1/L2/L3)
// ---------------------------------------------------------------------------

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
  status?: string
  isActive?: boolean
  medusa_id?: string | null
  segment?: { id: string; name: string; code: string }
  children?: TrustClawCategory[]
}

// ---------------------------------------------------------------------------
// Vendor Types (transaction modes)
// ---------------------------------------------------------------------------

export type TrustClawVendorType = {
  id: string
  name: string
  code: string
  description: string | null
  sortOrder: number
  status: string
  isActive: boolean
  vendorCategoryCount: number
}

// ---------------------------------------------------------------------------
// Vendor Categories (store classifications)
// ---------------------------------------------------------------------------

export type TrustClawVendorCategory = {
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

// ---------------------------------------------------------------------------
// P2V Mapped Categories
// ---------------------------------------------------------------------------

export type TrustClawMappedCategory = {
  id: string
  name: string
  code: string
  parentId: string | null
  level: number
  hasChildren: boolean
  sortOrder: number
  directProductCount: number
}
