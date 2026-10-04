/**
 * Ids of the products that are bookable services. A card cannot ask the
 * backend about every product (one request each), and a service with a single
 * variant must not get a one-tap ADD: it would be bought with no person and no
 * time.
 *
 * This is called while rendering every listing, so it must be cheap. It used to
 * hit the backend uncached on every page view (a businesses call and then one
 * call per business, about two seconds against a remote database). The result
 * barely changes, so it is cached across requests for five minutes with Next's
 * fetch cache, and the per-business calls run in parallel. A failure just means
 * "none known", so a backend hiccup never breaks a listing.
 */
const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
const REVALIDATE_SECONDS = 300

type BusinessList = { businesses?: { handle: string }[] }
type BusinessDetail = {
  resources?: { services?: { product_id: string }[] }[]
}

const get = async <T,>(path: string): Promise<T | null> => {
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      headers: { "x-publishable-api-key": KEY },
      next: { revalidate: REVALIDATE_SECONDS, tags: ["appointment-products"] },
    })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

export const getAppointmentProductIds = async (
  _countryCode: string,
  currencyCode?: string
): Promise<ReadonlySet<string>> => {
  const ids = new Set<string>()
  const list = await get<BusinessList>("/store/appointments/businesses?limit=50")

  const details = await Promise.all(
    (list?.businesses ?? []).map((business) =>
      get<BusinessDetail>(
        `/store/appointments/businesses/${encodeURIComponent(business.handle)}${
          currencyCode ? `?currency_code=${encodeURIComponent(currencyCode)}` : ""
        }`
      )
    )
  )

  for (const detail of details) {
    for (const resource of detail?.resources ?? []) {
      for (const service of resource.services ?? []) {
        ids.add(service.product_id)
      }
    }
  }
  return ids
}
