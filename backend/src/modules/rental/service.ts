import { MedusaService } from "@medusajs/framework/utils"
import { Rental } from "./models/rental"
import { RentalConfiguration } from "./models/rental-configuration"

class RentalModuleService extends MedusaService({
  Rental,
  RentalConfiguration,
}) {
  async hasRentalOverlap(
    variant_id: string,
    start_date: Date,
    end_date: Date
  ) {
    const [, count] = await this.listAndCountRentals({
      variant_id,
      status: ["active", "pending"],
      $or: [
        {
          rental_start_date: {
            $lte: end_date,
          },
          rental_end_date: {
            $gte: start_date,
          },
        },
      ],
    })

    return count > 0
  }

  /**
   * Batched form of hasRentalOverlap for validating several rental line
   * items at once (order-completion / checkout-time re-validation, which
   * previously called hasRentalOverlap once per item in a loop - one DB
   * round-trip per item). Fetches every active/pending rental across all
   * involved variants in a single query, then resolves each check in memory
   * against that one result set - same overlap predicate as hasRentalOverlap,
   * applied per-check locally instead of via N separate queries.
   *
   * Returns a Set of the input checks' indexes that have an overlap, so
   * callers can report which specific item(s) failed.
   */
  async hasAnyRentalOverlap(
    checks: { variant_id: string; start_date: Date; end_date: Date }[]
  ): Promise<Set<number>> {
    const overlapping = new Set<number>()

    if (checks.length === 0) {
      return overlapping
    }

    const variantIds = Array.from(new Set(checks.map((c) => c.variant_id)))

    const rentals = await this.listRentals({
      variant_id: variantIds,
      status: ["active", "pending"],
    })

    checks.forEach((check, index) => {
      const hasOverlap = rentals.some(
        (rental) =>
          rental.variant_id === check.variant_id &&
          rental.rental_start_date <= check.end_date &&
          rental.rental_end_date >= check.start_date
      )

      if (hasOverlap) {
        overlapping.add(index)
      }
    })

    return overlapping
  }

  /**
   * Every already-booked date range for a variant within a window, for
   * painting blocked dates on a calendar ahead of time. Same overlap
   * predicate as hasRentalOverlap, just returning the ranges instead of a
   * yes/no for one specific range.
   */
  async listBookedRanges(
    variant_id: string,
    window_start: Date,
    window_end: Date
  ) {
    const rentals = await this.listRentals({
      variant_id,
      status: ["active", "pending"],
      $or: [
        {
          rental_start_date: {
            $lte: window_end,
          },
          rental_end_date: {
            $gte: window_start,
          },
        },
      ],
    })

    return rentals.map((rental) => ({
      start_date: rental.rental_start_date,
      end_date: rental.rental_end_date,
    }))
  }
}

export default RentalModuleService
