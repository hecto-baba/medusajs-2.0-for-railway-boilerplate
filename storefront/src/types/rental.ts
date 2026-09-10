export type RentalConfiguration = {
  id: string
  product_id: string
  min_rental_days: number
  max_rental_days: number | null
  status: "active" | "inactive"
}

export type RentalAvailability = {
  available: boolean
  price: {
    amount: number
    currency_code?: string
  }
}

export type RentalSelection = {
  rental_start_date: string
  rental_end_date: string
  rental_days: number
}

/**
 * The storefront receives the rental configuration through the product's
 * linked module, so it arrives alongside the standard product fields rather
 * than from a separate request.
 */
export type StoreProductWithRental = {
  rental_configuration?: RentalConfiguration | null
}
