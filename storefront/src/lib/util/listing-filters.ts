/**
 * Filters for the product listings (store, category, collection). They live in
 * the URL (?onSale=1&min=10&max=50) so a filtered page can be shared and the
 * back button works. Prices are in the store's major currency units.
 */
export type ListingFilters = {
  onSale?: boolean
  minPrice?: number
  maxPrice?: number
}

type RawFilters = { onSale?: string; min?: string; max?: string }

const toPrice = (value?: string) => {
  if (value === undefined || value.trim() === "") return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

export const parseListingFilters = (raw: RawFilters): ListingFilters => ({
  onSale: raw.onSale === "1" || undefined,
  minPrice: toPrice(raw.min),
  maxPrice: toPrice(raw.max),
})

export const hasListingFilters = (filters?: ListingFilters) =>
  !!filters && (!!filters.onSale || filters.minPrice !== undefined || filters.maxPrice !== undefined)
