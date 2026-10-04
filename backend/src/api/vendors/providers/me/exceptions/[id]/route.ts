import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../../modules/appointment-booking/service"

/**
 * Removes one of the calling vendor's own exceptions. Scoped on actor_id; an
 * exception that belongs to another vendor answers 404, indistinguishable from
 * one that does not exist.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const [provider] = await service.listProviders(
    { vendor_admin_id: req.auth_context.actor_id },
    { select: ["id"], take: 1 }
  )

  if (!provider) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No provider profile found.")
  }

  const [exception] = await service.listAvailabilityExceptions(
    { id, provider_id: provider.id },
    { select: ["id"], take: 1 }
  )

  if (!exception) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Exception not found.")
  }

  await service.deleteAvailabilityExceptions(id)

  res.json({ id, deleted: true })
}
