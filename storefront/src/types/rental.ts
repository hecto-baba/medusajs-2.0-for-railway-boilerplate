export type RentalUnit = "hour" | "day" | "week" | "month" | "custom"
export type RentalDepositType = "fixed" | "percentage"
export type RentalFulfilmentModes = "both" | "pickup" | "delivery"

export type RentalConfiguration = {
  id: string
  product_id: string
  // Deprecated in favor of rental_unit + min/max_rental_units. Kept so a
  // config that predates the unit/deposit migration still type-checks;
  // day-unit configs mirror their values into both column pairs.
  min_rental_days: number
  max_rental_days: number | null
  rental_unit: RentalUnit
  min_rental_units: number
  max_rental_units: number | null
  security_deposit_amount: number
  security_deposit_type: RentalDepositType
  requires_time_selection: boolean
  // How the seller lets the rental reach the renter. Optional because a
  // configuration saved before this existed has none, which means "both".
  fulfilment_modes?: RentalFulfilmentModes
  status: "active" | "inactive"
}

export type RentalBookedRange = {
  start_date: string
  end_date: string
}

export type RentalAvailability = {
  available: boolean
  price: {
    amount: number
    currency_code?: string
  }
  deposit: {
    amount: number
    type: RentalDepositType
    currency_code?: string
  }
}

export type RentalSelection = {
  rental_start_date: string
  rental_end_date: string
  rental_days: number
  rental_unit: RentalUnit
  rental_units_count: number
  pickup_time: string | null
  return_time: string | null
  deposit_amount: number
}

/**
 * The storefront receives the rental configuration through the product's
 * linked module, so it arrives alongside the standard product fields rather
 * than from a separate request.
 */
export type StoreProductWithRental = {
  rental_configuration?: RentalConfiguration | null
}
