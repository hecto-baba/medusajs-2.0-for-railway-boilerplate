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
