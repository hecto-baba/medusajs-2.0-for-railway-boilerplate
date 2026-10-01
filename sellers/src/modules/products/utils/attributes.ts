import type { VendorProduct } from "@lib/data/vendor-client"

/**
 * Known common acronyms to keep uppercase in title formatting
 */
const ACRONYMS = new Set([
  "MID",
  "HS",
  "SKU",
  "URL",
  "ID",
  "RAM",
  "CPU",
  "GPU",
  "SSD",
  "HDD",
  "OS",
  "FSSAI",
  "GST",
  "UPC",
  "EAN",
  "ISBN",
])

/**
 * Formats a raw attribute key (e.g. `item_form`, `dietary_preference`, `seller_license_no`)
 * into human-readable Title Case (e.g. "Item Form", "Dietary Preference", "Seller License No").
 */
export function formatAttributeKey(key: string): string {
  if (!key) return ""

  // Clean key: replace underscores and hyphens with spaces, split camelCase
  const clean = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()

  return clean
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase()
      if (ACRONYMS.has(upper)) return upper
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(" ")
}

/**
 * Extracts and normalizes custom/TrustClaw attributes from a VendorProduct.
 * Handles:
 * - `product.metadata.attributes` (as object or JSON string)
 * - `product.metadata.attribute`
 * - `product.metadata.trustclaw_attributes`
 * - `product.metadata.custom_attributes`
 * - `(product as any).attributes`
 * - Arrays of `{ key/name, value }`
 */
export function extractProductAttributes(
  product: VendorProduct | null | undefined
): Record<string, unknown> | null {
  if (!product) return null

  const meta = product.metadata as Record<string, unknown> | null | undefined
  const candidate =
    meta?.attributes ??
    meta?.attribute ??
    meta?.trustclaw_attributes ??
    meta?.custom_attributes ??
    (product as Record<string, unknown>).attributes

  if (!candidate) return null

  let parsed: unknown = candidate
  if (typeof candidate === "string") {
    try {
      parsed = JSON.parse(candidate)
    } catch {
      return null
    }
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>
    if (Object.keys(record).length > 0) {
      return record
    }
    return null
  }

  if (Array.isArray(parsed)) {
    const record: Record<string, unknown> = {}
    for (const item of parsed) {
      if (item && typeof item === "object") {
        const k =
          (item as Record<string, unknown>).key ??
          (item as Record<string, unknown>).name ??
          (item as Record<string, unknown>).attribute ??
          (item as Record<string, unknown>).label ??
          (item as Record<string, unknown>).title
        const v =
          (item as Record<string, unknown>).value ??
          (item as Record<string, unknown>).val
        if (k) {
          record[String(k)] = v
        }
      }
    }
    if (Object.keys(record).length > 0) {
      return record
    }
  }

  return null
}

/**
 * Serializes an attribute value cleanly for display or search.
 */
export function formatAttributeValue(val: unknown): string {
  if (val === null || val === undefined) return ""
  if (typeof val === "boolean") return val ? "Yes" : "No"
  if (typeof val === "object") {
    if (Array.isArray(val)) {
      return val.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ")
    }
    return JSON.stringify(val)
  }
  return String(val)
}
