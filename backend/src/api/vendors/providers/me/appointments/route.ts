import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../modules/appointment-booking/service"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const [provider] = await service.listProviders({
    vendor_admin_id: req.auth_context.actor_id,
  })

  if (!provider) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No provider profile found for the authenticated session."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: appointments } = await query.graph({
    entity: "appointment",
    fields: [
      "id",
      "start_time",
      "end_time",
      "max_capacity",
      "status",
      "service_product.*",
      "attendees.*",
    ],
    filters: { provider_id: provider.id },
  })

  res.json({ appointments })
}
