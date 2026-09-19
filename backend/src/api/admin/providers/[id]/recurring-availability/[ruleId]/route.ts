import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../../modules/appointment-booking/service"

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { ruleId } = req.params
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  await service.deleteRecurringAvailabilities(ruleId)

  res.json({ id: ruleId, deleted: true })
}
