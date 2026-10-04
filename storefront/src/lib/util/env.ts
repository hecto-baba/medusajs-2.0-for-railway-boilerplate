/**
 * Public URL this storefront is served from. It feeds `metadataBase`, so it
 * decides the absolute URLs in canonical tags and Open Graph images.
 *
 * The old fallback was `https://localhost:8000`, which is wrong twice over:
 * local development is http, and shipping a localhost metadataBase means
 * every shared link resolves to the visitor's own machine.
 */
export const getBaseURL = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }

  // Railway exposes the assigned domain without a scheme. This is read during
  // metadata generation on the server, so a non-public var is fine here.
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN
  if (railwayDomain) {
    return railwayDomain.startsWith("http")
      ? railwayDomain
      : `https://${railwayDomain}`
  }

  return "http://localhost:8000"
}

/**
 * Your shop's own name, shown in the nav, footer, checkout header, page titles
 * and legal copy. Set NEXT_PUBLIC_STORE_NAME to your store's name. The fallback
 * is a placeholder on purpose, so an unconfigured deploy prompts you to set it
 * rather than shipping someone else's brand.
 */
export const getStoreName = () => {
  return process.env.NEXT_PUBLIC_STORE_NAME || "Your Store"
}

/**
 * Delivery promise shown in the header and cart, for example "9 mins".
 * Display only: there is no delivery-time model in the backend yet, so the
 * storefront shows it only when the owner sets NEXT_PUBLIC_DELIVERY_ETA and
 * never invents a promise of its own.
 */
export const getDeliveryEta = () => {
  const value = process.env.NEXT_PUBLIC_DELIVERY_ETA?.trim()
  return value ? value : null
}

/**
 * Order subtotal (in the store's major currency units) above which delivery is
 * free, used by the cart's progress bar. Display only. Unset or invalid means
 * the bar is hidden.
 */
export const getFreeDeliveryThreshold = () => {
  const value = Number(process.env.NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD)
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Whether to show the search entry point in the nav.
 *
 * On by default, opt out with NEXT_PUBLIC_FEATURE_SEARCH_DISABLED=true.
 *
 * This used to be the other way round, an opt-in
 * NEXT_PUBLIC_FEATURE_SEARCH_ENABLED, and that default cost real stores their
 * search. The Railway template provisions Meilisearch, derives a search key and
 * indexes the catalogue, but never set the opt-in flag, so every deploy ran a
 * fully working and completely unreachable search: the nav link is the only
 * route into it anywhere in the UI. Defaulting to on means the shipped
 * infrastructure and the shipped UI agree, and local development matches a
 * deploy without extra configuration.
 *
 * Compared against the string rather than read for truthiness. Env values are
 * always strings, so the old truthy check treated "false" as enabled.
 */
export const isSearchEnabled = () => {
  return process.env.NEXT_PUBLIC_FEATURE_SEARCH_DISABLED !== "true"
}
