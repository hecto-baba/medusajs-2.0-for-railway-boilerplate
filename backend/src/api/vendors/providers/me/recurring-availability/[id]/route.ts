import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../../modules/appointment-booking/service"

async function assertOwnRule(req: AuthenticatedMedusaRequest, ruleId: string) {
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const [provider] = await service.listProviders({
    vendor_admin_id: req.auth_context.actor_id,
  })

  if (!provider) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No provider profile found.")
  }

  const rule = await service.retrieveRecurringAvailability(ruleId)

  if (rule.provider_id !== provider.id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This recurring availability rule does not belong to you."
    )
  }

  return service
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const service = await assertOwnRule(req, id)

  await service.deleteRecurringAvailabilities(id)

  res.json({ id, deleted: true })
}
