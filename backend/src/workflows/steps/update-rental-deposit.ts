import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { RENTAL_MODULE } from "../../modules/rental"
import RentalModuleService from "../../modules/rental/service"
import { MedusaError } from "@medusajs/framework/utils"

type DepositStatus = "held" | "refunded" | "partially_refunded" | "forfeited"

type UpdateRentalDepositInput = {
  rental_id: string
  status: DepositStatus
}

/**
 * Pure record-keeping: marks what the admin decided about a held deposit
 * after inspecting the returned item. No payment-provider call is made here
 * - actually moving money (refund, capture, void) is a separate, later
 * phase that needs sandbox testing against the store's payment provider
 * before any production use.
 */
export const updateRentalDepositStep = createStep(
  "update-rental-deposit",
  async ({ rental_id, status }: UpdateRentalDepositInput, { container }) => {
    const rentalModuleService: RentalModuleService = container.resolve(RENTAL_MODULE)

    const existingRental = await rentalModuleService.retrieveRental(rental_id)

    if (!existingRental.security_deposit_status) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This rental has no security deposit to manage."
      )
    }

    const updatedRental = await rentalModuleService.updateRentals({
      id: rental_id,
      security_deposit_status: status,
    })

    return new StepResponse(updatedRental, existingRental)
  },
  async (existingRental, { container }) => {
    if (!existingRental) return

    const rentalModuleService: RentalModuleService = container.resolve(RENTAL_MODULE)

    await rentalModuleService.updateRentals({
      id: existingRental.id,
      security_deposit_status: existingRental.security_deposit_status,
    })
  }
)
