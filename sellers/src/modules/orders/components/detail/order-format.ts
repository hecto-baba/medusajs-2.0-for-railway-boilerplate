import { formatDistance } from "date-fns"
import type {
  VendorOrderDetail,
  VendorOrderPayment,
} from "@lib/data/vendor-client"

/**
 * Formatting and status helpers for the order detail page, ported from the
 * admin dashboard (lib/money-amount-helpers, lib/order-helpers, lib/payment)
 * so amounts and badges read exactly as they do in the admin.
 */

/** "€300.00" - the admin's getLocaleAmount. */
export const getLocaleAmount = (amount: number | null | undefined, currencyCode: string) =>
  new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: currencyCode.toUpperCase(),
  }).format(amount ?? 0)

const nativeSymbol = (currencyCode: string) =>
  new Intl.NumberFormat([], {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    currencyDisplay: "narrowSymbol",
  })
    .format(0)
    .replace(/\d/g, "")
    .replace(/[.,]/g, "")
    .trim()

/** "€ 310.00 EUR" - the admin's getStylizedAmount, used for totals. */
export const getStylizedAmount = (amount: number | null | undefined, currencyCode: string) => {
  const digits = new Intl.NumberFormat([], {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).resolvedOptions().maximumFractionDigits

  const total = (amount ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

  return `${nativeSymbol(currencyCode)} ${total} ${currencyCode.toUpperCase()}`
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const pad = (n: number) => String(n).padStart(2, "0")

/** "05 Oct, 2026, 10:57:41" - the admin's payment/refund timestamp. */
export const formatDateTime = (value: string | Date) => {
  const d = new Date(value)
  if (isNaN(d.getTime())) return ""
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** "Oct 5, 2026, 10:57 AM" - the admin's getFullDate with time. */
export const getFullDate = (value: string | Date, includeTime = false) => {
  const d = new Date(value)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  })
}

/** "about 24 hours ago" - the same wording the admin gets from date-fns. */
export const getRelativeDate = (value: string | Date) => {
  const date = new Date(value)
  // formatDistance throws on an invalid date; show nothing rather than crash the page.
  return isNaN(date.getTime()) ? "" : formatDistance(date, new Date(), { addSuffix: true })
}

type Color = "red" | "orange" | "green" | "grey"

/** Last 7 characters after the prefix, as the admin's DisplayId shows it. */
export const displayId = (id: string) => `#${id.split("_").pop()?.slice(-7).toUpperCase()}`

const collectionsOf = (order: VendorOrderDetail) => order.payment_collections ?? []

export const getPayments = (order: VendorOrderDetail): VendorOrderPayment[] =>
  collectionsOf(order)
    .flatMap((collection) => collection.payments ?? [])
    .filter(Boolean)

export const getTotalCaptured = (order: VendorOrderDetail) =>
  collectionsOf(order).reduce(
    (sum, c) => sum + ((c.captured_amount ?? 0) - (c.refunded_amount ?? 0)),
    0
  )

export const getTotalPending = (order: VendorOrderDetail) =>
  collectionsOf(order)
    .filter((c) => c.status !== "canceled")
    .reduce((sum, c) => sum + ((c.amount ?? 0) - (c.captured_amount ?? 0)), 0)

const toLabel = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

/** Payment status as the admin derives it from the collections. */
export const getOrderPaymentStatus = (order: VendorOrderDetail): { label: string; color: Color } => {
  const collections = collectionsOf(order)
  const status = collections[0]?.status ?? "not_paid"
  const color: Color =
    status === "captured" || status === "completed"
      ? "green"
      : status === "authorized" || status === "awaiting" || status === "requires_action"
        ? "orange"
        : "red"
  return { label: toLabel(status === "completed" ? "captured" : status), color }
}

export const getOrderFulfillmentStatus = (order: VendorOrderDetail): { label: string; color: Color } => {
  const fulfillments = (order.fulfillments ?? []).filter((f) => !f.canceled_at)
  if (!fulfillments.length) return { label: "Not fulfilled", color: "red" }
  if (fulfillments.every((f) => f.delivered_at)) return { label: "Delivered", color: "green" }
  if (fulfillments.some((f) => f.delivered_at)) return { label: "Partially delivered", color: "orange" }
  if (fulfillments.every((f) => f.shipped_at)) return { label: "Shipped", color: "green" }
  if (fulfillments.some((f) => f.shipped_at)) return { label: "Partially shipped", color: "orange" }
  return { label: "Fulfilled", color: "green" }
}

export const formatAddress = (address: Record<string, any> | null | undefined): string[] => {
  if (!address) return []
  const name = [address.first_name, address.last_name].filter(Boolean).join(" ")
  const lines: string[] = []
  if (name) lines.push(name)
  if (address.company) lines.push(address.company)
  if (address.address_1) lines.push(address.address_1)
  if (address.address_2) lines.push(address.address_2)
  const cityProvincePostal = [address.city, address.province, address.postal_code]
    .filter(Boolean)
    .join(" ")
  if (cityProvincePostal) lines.push(cityProvincePostal)
  const code = address.country_code as string | undefined
  let country: string | undefined = address.country?.display_name
  if (!country && code) {
    try {
      country = new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase())
    } catch {
      country = code.toUpperCase()
    }
  }
  if (country) lines.push(country)
  return lines
}

export const isSameAddress = (a: Record<string, any> | null | undefined, b: Record<string, any> | null | undefined) => {
  if (!a || !b) return false
  const keys = ["first_name", "last_name", "address_1", "address_2", "city", "postal_code", "province", "country_code"]
  return keys.every((key) => (a[key] || "") === (b[key] || ""))
}
