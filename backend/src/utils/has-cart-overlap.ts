export default function hasCartOverlap(
  item: {
    variant_id: string
    rental_start_date: Date
    rental_end_date: Date
    rental_days: number
  },
  cart_items: {
    id: string
    variant_id: string
    metadata?: Record<string, unknown>
  }[]
): boolean {
  for (const cartItem of cart_items) {
    if (cartItem.variant_id !== item.variant_id) {
      continue
    }

    const cartItemMetadata = cartItem.metadata || {}
    const existingStartStr = cartItemMetadata.rental_start_date
    const existingEndStr = cartItemMetadata.rental_end_date
    const existingDays = cartItemMetadata.rental_days

    if (!existingStartStr || !existingEndStr || !existingDays) {
      continue
    }

    const existingStartDate = new Date(existingStartStr as string)
    const existingEndDate = new Date(existingEndStr as string)

    const hasOverlap =
      item.rental_start_date <= existingEndDate &&
      item.rental_end_date >= existingStartDate

    if (hasOverlap) {
      return true
    }
  }

  return false
}
