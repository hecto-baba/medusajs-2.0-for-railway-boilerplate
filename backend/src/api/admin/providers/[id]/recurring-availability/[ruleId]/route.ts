import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../../modules/appointment-booking/service"

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id, ruleId } = req.params
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  // The rule must belong to the provider in the URL; otherwise 404 (same answer
  // as a rule that does not exist).
  const [rule] = await service.listRecurringAvailabilities(
    { id: ruleId, provider_id: id },
    { select: ["id"], take: 1 }
  )

  if (!rule) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Recurring availability rule not found."
    )
  }

  await service.deleteRecurringAvailabilities(ruleId)

  res.json({ id: ruleId, deleted: true })
}
