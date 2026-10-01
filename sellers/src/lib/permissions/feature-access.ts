import type { VendorOnboardingData } from "../data/vendor-client"

export type FeatureKey =
  | "orders"
  | "products"
  | "inventory"
  | "customers"
  | "pricing"
  | "promotions"
  | "venues"
  | "shows"
  | "rentals"
  | "settings"

export interface VendorCapabilities {
  hasOrders: boolean
  hasProducts: boolean
  hasInventory: boolean
  hasCustomers: boolean
  hasPricing: boolean
  hasPromotions: boolean
  hasVenues: boolean
  hasShows: boolean
  hasRentals: boolean
  hasSettings: boolean
}

/**
 * Derives the vendor's active feature set based on their segment and transaction vendorType.
 *
 * Rules:
 * - Venues & Shows are only visible if vendorType is "BOOKING" / "TICKETING" or segment is "EVENTS" / "ENTERTAINMENT" / "VENUE".
 * - Rentals are enabled if vendorType is "RENTAL".
 * - Physical inventory / products / orders are standard for "ORDER", "RETAIL", "GROCERY", etc.
 */
export function getVendorCapabilities(
  onboarding?: VendorOnboardingData | null
): VendorCapabilities {
  // If no onboarding data exists or in unrestricted fallback, provide core commerce capabilities
  if (!onboarding) {
    return {
      hasOrders: true,
      hasProducts: true,
      hasInventory: true,
      hasCustomers: true,
      hasPricing: true,
      hasPromotions: true,
      hasVenues: true,
      hasShows: true,
      hasRentals: true,
      hasSettings: true,
    }
  }

  const vendorTypeCode = (
    onboarding.vendorType?.code ||
    onboarding.vendorType?.name ||
    ""
  ).toUpperCase()
  const segmentCode = (
    onboarding.segment?.code ||
    onboarding.segment?.name ||
    ""
  ).toUpperCase()
  const vendorCategoryCode = (
    onboarding.vendorCategory?.code ||
    onboarding.vendorCategory?.name ||
    ""
  ).toUpperCase()

  const vendorTypeId = (onboarding.vendorTypeId || "").toLowerCase()
  const segmentId = (onboarding.segmentId || "").toLowerCase()
  const vendorCategoryId = (onboarding.vendorCategoryId || "").toLowerCase()

  // Entertainment / Live Events / Venues / Shows is specifically for Concerts, Arenas, Theatres, and Event Booking
  const isEntertainmentOrEventsSegment =
    segmentCode.includes("EVENT") ||
    segmentCode.includes("ENTERTAINMENT") ||
    segmentCode.includes("VENUE") ||
    segmentCode.includes("THEATRE") ||
    segmentCode.includes("CONCERT") ||
    segmentId.includes("entertainment") ||
    segmentId.includes("event") ||
    segmentId.includes("venue")

  const isVenueOrEventCategory =
    vendorCategoryCode.includes("VENUE") ||
    vendorCategoryCode.includes("SHOW") ||
    vendorCategoryCode.includes("CONCERT") ||
    vendorCategoryCode.includes("THEATRE") ||
    vendorCategoryCode.includes("STADIUM") ||
    vendorCategoryCode.includes("ARENA") ||
    vendorCategoryId.includes("venue") ||
    vendorCategoryId.includes("concert") ||
    vendorCategoryId.includes("arena")

  const isTicketingModel =
    vendorTypeCode.includes("TICKET") ||
    vendorTypeId.includes("ticket")

  const isTicketingOrEvents =
    isEntertainmentOrEventsSegment ||
    isVenueOrEventCategory ||
    (isTicketingModel &&
      !["GROCERY", "HOME_SERVICES", "HEALTHCARE", "AGRICULTURE", "JEWELLERY", "AUTOMOBILES", "CONSTRUCTION_MATERIALS"].includes(
        segmentCode
      ))

  const isRental =
    vendorTypeCode.includes("RENTAL") ||
    segmentCode.includes("RENTAL") ||
    vendorTypeId.includes("rental") ||
    segmentId.includes("rental")

  const isPureService =
    (vendorTypeCode.includes("SERVICE") ||
      vendorTypeCode.includes("ENQUIRY") ||
      vendorTypeCode.includes("EOI")) &&
    !isRental &&
    !vendorTypeCode.includes("ORDER")

  return {
    hasOrders: true,
    hasProducts: !isTicketingOrEvents,
    hasInventory: !isPureService && !isTicketingOrEvents,
    hasCustomers: true,
    hasPricing: true,
    hasPromotions: true,
    hasVenues: isTicketingOrEvents,
    hasShows: isTicketingOrEvents,
    hasRentals: isRental,
    hasSettings: true,
  }
}

/**
 * Checks if a specific route is accessible for the vendor's capabilities.
 */
export function isRouteAllowed(
  pathname: string,
  capabilities: VendorCapabilities
): boolean {
  if (pathname.startsWith("/venues") && !capabilities.hasVenues) {
    return false
  }
  if (pathname.startsWith("/shows") && !capabilities.hasShows) {
    return false
  }
  if (pathname.startsWith("/inventory") && !capabilities.hasInventory) {
    return false
  }
  if (pathname.startsWith("/reservations") && !capabilities.hasInventory) {
    return false
  }
  if (pathname.startsWith("/products") && !capabilities.hasProducts) {
    return false
  }
  return true
}
