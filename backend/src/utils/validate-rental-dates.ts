import { MedusaError } from "@medusajs/framework/utils"

export default function validateRentalDates(
  rentalStartDate: string | Date,
  rentalEndDate: string | Date,
  rentalConfiguration: {
    min_rental_days: number
    max_rental_days: number | null
  },
  rentalDays: number | string
) {
  const startDate =
    rentalStartDate instanceof Date ? rentalStartDate : new Date(rentalStartDate)
  const endDate =
    rentalEndDate instanceof Date ? rentalEndDate : new Date(rentalEndDate)
  const days = typeof rentalDays === "number" ? rentalDays : Number(rentalDays)

  if (days < rentalConfiguration.min_rental_days) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Rental period of ${days} days is less than the minimum of ${rentalConfiguration.min_rental_days} days`
    )
  }

  if (
    rentalConfiguration.max_rental_days !== null &&
    days > rentalConfiguration.max_rental_days
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Rental period of ${days} days exceeds the maximum of ${rentalConfiguration.max_rental_days} days`
    )
  }

  // Incoming dates are "YYYY-MM-DD" strings parsed as UTC midnight, so the
  // floor they are compared against has to be UTC midnight too. Using a
  // server-local midnight rejected a legitimately-chosen today whenever the
  // server sat ahead of the shopper.
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  if (startDate < now || endDate < now) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Rental dates cannot be in the past. Received start date: ${startDate.toISOString()}, end date: ${endDate.toISOString()}`
    )
  }

  // Rental days are counted inclusively, so an end date equal to the start
  // date is a one-day rental rather than an empty period. Only an end date
  // strictly before the start is invalid.
  if (endDate < startDate) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `rentalEndDate must be on or after rentalStartDate`
    )
  }
}
