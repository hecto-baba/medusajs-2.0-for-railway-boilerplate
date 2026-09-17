import countRentalDays from "./count-rental-days"
import { RENTAL_UNIT_DAY_SIZE, RentalUnit } from "./rental-unit"

/**
 * Converts a start/end range into a quantity in the given rental unit.
 *
 * For "hour", the range must carry real time-of-day (not just a date) and the
 * quantity is the elapsed whole hours between the two instants - this is the
 * one unit that is NOT day-granular, so it does not go through
 * countRentalDays at all. For every other unit, day-granularity is the ground
 * truth (matches countRentalDays, inclusive of both endpoints); week/month/
 * custom derive from it.
 */
export default function countRentalUnits(
  rentalStartDate: string | Date,
  rentalEndDate: string | Date,
  unit: RentalUnit
): number {
  if (unit === "hour") {
    const startDate =
      rentalStartDate instanceof Date ? rentalStartDate : new Date(rentalStartDate)
    const endDate =
      rentalEndDate instanceof Date ? rentalEndDate : new Date(rentalEndDate)
    const minutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60)

    return Math.max(1, Math.round(minutes / 60))
  }

  const days = countRentalDays(rentalStartDate, rentalEndDate)
  const unitSizeInDays = RENTAL_UNIT_DAY_SIZE[unit]

  return Math.max(1, Math.round(days / unitSizeInDays))
}
