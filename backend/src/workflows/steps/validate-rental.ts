import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { RENTAL_MODULE } from "../../modules/rental"
import RentalModuleService from "../../modules/rental/service"
import { InferTypeOf } from "@medusajs/framework/types"
import { RentalConfiguration } from "../../modules/rental/models/rental-configuration"
import hasCartOverlap from "../../utils/has-cart-overlap"
import validateRentalDates from "../../utils/validate-rental-dates"
import countRentalDays from "../../utils/count-rental-days"
import countRentalUnits from "../../utils/count-rental-units"
import { RentalUnit } from "../../utils/rental-unit"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"

export type ValidateRentalInput = {
  rental_items: {
    line_item_id: string
    variant_id: string
    quantity: number
    rental_configuration: InferTypeOf<typeof RentalConfiguration>
    rental_start_date: Date
    rental_end_date: Date
    rental_days: number
    rental_units_count?: number
  }[]
  order_id: string
}

export const validateRentalStep = createStep(
  "validate-rental",
  async ({ rental_items, order_id }: ValidateRentalInput, { container }) => {
    const rentalModuleService: RentalModuleService = container.resolve(RENTAL_MODULE)

    // Pass 1: every synchronous, in-memory check (config/quantity/metadata/
    // date validity, plus overlap against sibling items in this same order).
    // Errors here throw immediately, in item order, exactly as before.
    // The DB-backed overlap check is deferred to a single batched call after
    // this loop instead of one query per item - see hasAnyRentalOverlap.
    const dbOverlapChecks: {
      variant_id: string
      start_date: Date
      end_date: Date
    }[] = []

    for (let i = 0; i < rental_items.length; i++) {
      const rentalItem = rental_items[i]
      const {
        line_item_id,
        variant_id,
        quantity,
        rental_configuration,
        rental_start_date,
        rental_end_date,
        rental_days,
      } = rentalItem

      if (rental_configuration.status !== "active") {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Rental configuration for variant ${variant_id} is not active`
        )
      }

      // Validate quantity is 1 for rental items
      if (quantity !== 1) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Rental items must have a quantity of 1. Line item ${line_item_id} has quantity ${quantity}`
        )
      }

      // Validate metadata presence
      if (!rental_start_date || !rental_end_date || !rental_days) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Line item ${line_item_id} is for a rentable product but missing required metadata: rental_start_date, rental_end_date and/or rental_days`
        )
      }

      const startDate = rental_start_date instanceof Date ? rental_start_date : new Date(rental_start_date)
      const endDate = rental_end_date instanceof Date ? rental_end_date : new Date(rental_end_date)

      // Recomputed from the actual dates rather than trusting the
      // rental_days/rental_units_count carried on the item: those values
      // originate from order line-item metadata, which was already correct
      // at add-to-cart time but is never re-derived between then and this
      // (final, pre-persistence) checkpoint. Recomputing here means this
      // check still catches a bad/tampered/stale count instead of validating
      // against it, matching every other validateRentalDates call site.
      const derivedRentalDays = countRentalDays(startDate, endDate)
      const configuredUnit: RentalUnit =
        (rental_configuration.rental_unit as RentalUnit) ?? "day"
      const derivedUnitsCount =
        configuredUnit === "day" || configuredUnit === "custom"
          ? derivedRentalDays
          : countRentalUnits(startDate, endDate, configuredUnit)

      validateRentalDates(
        startDate,
        endDate,
        {
          min_rental_days: rental_configuration.min_rental_days,
          max_rental_days: rental_configuration.max_rental_days,
          rental_unit: rental_configuration.rental_unit as any,
          min_rental_units: rental_configuration.min_rental_units,
          max_rental_units: rental_configuration.max_rental_units,
        },
        derivedRentalDays,
        derivedUnitsCount
      )

      const hasCartOverlapResult = hasCartOverlap(
        {
          variant_id,
          rental_start_date,
          rental_end_date,
          rental_days: derivedRentalDays,
        },
        rental_items.slice(i + 1).map((item) => ({
          id: item.line_item_id,
          variant_id: item.variant_id,
          metadata: {
            rental_start_date: item.rental_start_date.toISOString(),
            rental_end_date: item.rental_end_date.toISOString(),
            rental_days: item.rental_days,
          }
        }))
      )

      if (hasCartOverlapResult) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Cannot have multiple rental items for variant ${variant_id} with overlapping dates in the cart`
        )
      }

      dbOverlapChecks.push({ variant_id, start_date: startDate, end_date: endDate })
    }

    // Pass 2: one batched query for every item's DB-backed overlap check,
    // instead of the previous N sequential hasRentalOverlap calls. Reports
    // the first offending item, in the same item order as before, so the
    // error a caller sees for a single-conflict case is unchanged.
    const overlappingIndexes = await rentalModuleService.hasAnyRentalOverlap(
      dbOverlapChecks
    )

    if (overlappingIndexes.size > 0) {
      const firstOverlapIndex = Math.min(...overlappingIndexes)
      const { variant_id, start_date, end_date } = dbOverlapChecks[firstOverlapIndex]
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Variant ${variant_id} is already rented during the requested period (${start_date.toISOString()} to ${end_date.toISOString()})`
      )
    }

    return new StepResponse({ validated: true }, order_id)
  },
  async (order_id, { container, context }) => {
    if (!order_id) return

    cancelOrderWorkflow(container).run({
      input: {
        order_id,
      },
      context,
      container,
    })
  }
)

