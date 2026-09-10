/**
 * The number of days a rental covers, counted inclusively: the 15th to the
 * 15th is one day, the 15th to the 16th is two.
 *
 * Callers must never take this figure from the client. It sets the price
 * (daily rate x days) and is checked against the configured minimum and
 * maximum, so a supplied value would let a caller book a year and pay for a
 * day. Deriving it from the dates keeps the price, the limits and the stored
 * booking describing the same period.
 */
export default function countRentalDays(
  rentalStartDate: string | Date,
  rentalEndDate: string | Date
): number {
  const startDate =
    rentalStartDate instanceof Date ? rentalStartDate : new Date(rentalStartDate)
  const endDate =
    rentalEndDate instanceof Date ? rentalEndDate : new Date(rentalEndDate)

  const startUtc = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  )
  const endUtc = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  )

  return Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1
}
