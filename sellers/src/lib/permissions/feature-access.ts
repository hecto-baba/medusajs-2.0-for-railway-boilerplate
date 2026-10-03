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
  | "b2b"
  | "restaurants"
  | "digitalProducts"

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
  hasB2B: boolean
  hasRestaurants: boolean
  hasDigitalProducts: boolean
}

/**
 * Derives the vendor's active feature set based on their segment and transaction vendorType.
 *
 * Rules:
 * - Venues & Shows are only visible if vendorType is "BOOKING" / "TICKETING" or segment is "EVENTS" / "ENTERTAINMENT" / "VENUE".
 * - Rentals are enabled if vendorType is "RENTAL".
 * - B2B (Companies, Quotes, Approvals) is enabled for B2B/Wholesale vendors or multipurpose commerce vendors.
 * - Restaurants (Menu, Live Kitchen Deliveries) is enabled for Food/Beverage/Restaurant vendors or multipurpose commerce vendors.
 * - Digital Products is enabled for Digital vendors or multipurpose commerce vendors.
 */
export function getVendorCapabilities(
  onboarding?: VendorOnboardingData | null
): VendorCapabilities {
  // If no onboarding data exists or in unrestricted fallback, provide core commerce capabilities including multi-tenant multipurpose features
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
      hasB2B: true,
      hasRestaurants: true,
      hasDigitalProducts: true,
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

  // Restaurant & Food Delivery Detection
  const isRestaurant =
    segmentCode.includes("FOOD") ||
    segmentCode.includes("RESTAURANT") ||
    segmentCode.includes("BEVERAGE") ||
    segmentCode.includes("DINING") ||
    segmentCode.includes("CAFE") ||
    segmentCode.includes("BAKERY") ||
    segmentCode.includes("KITCHEN") ||
    segmentId.includes("food") ||
    segmentId.includes("restaurant") ||
    vendorCategoryCode.includes("FOOD") ||
    vendorCategoryCode.includes("RESTAURANT") ||
    vendorTypeCode.includes("RESTAURANT") ||
    vendorTypeCode.includes("DELIVERY") ||
    !isTicketingOrEvents // multipurpose commerce vendors have restaurant capability

  // B2B Wholesale / Corporate Detection
  const isB2B =
    segmentCode.includes("B2B") ||
    segmentCode.includes("WHOLESALE") ||
    segmentCode.includes("MANUFACTURING") ||
    segmentCode.includes("DISTRIBUTOR") ||
    segmentCode.includes("CONSTRUCTION") ||
    segmentCode.includes("AUTOMOBILES") ||
    vendorTypeCode.includes("B2B") ||
    vendorTypeCode.includes("WHOLESALE") ||
    !isTicketingOrEvents // multipurpose commerce vendors have B2B capability

  // Digital Products Detection
  const isDigital =
    segmentCode.includes("DIGITAL") ||
    segmentCode.includes("SOFTWARE") ||
    segmentCode.includes("MEDIA") ||
    segmentCode.includes("COURSE") ||
    segmentCode.includes("EBOOK") ||
    segmentCode.includes("DOWNLOAD") ||
    vendorTypeCode.includes("DIGITAL") ||
    vendorCategoryCode.includes("DIGITAL") ||
    !isTicketingOrEvents // multipurpose commerce vendors have digital products capability

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
    hasB2B: isB2B,
    hasRestaurants: isRestaurant,
    hasDigitalProducts: isDigital,
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
  if (pathname.startsWith("/b2b") && !capabilities.hasB2B) {
    return false
  }
  if (pathname.startsWith("/restaurants") && !capabilities.hasRestaurants) {
    return false
  }
  if (pathname.startsWith("/digital-products") && !capabilities.hasDigitalProducts) {
    return false
  }
  return true
}
