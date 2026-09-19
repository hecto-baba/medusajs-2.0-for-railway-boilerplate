import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../modules/appointment-booking/service"
import { createAppointmentSlotsWorkflow } from "../../../../../workflows/create-appointment-slots"

export const PostVendorAppointmentSlotsSchema = z.object({
  service_product_id: z.string(),
  service_variant_id: z.string().nullable().optional(),
  service_duration_minutes: z.number().int().min(1),
  max_capacity: z.number().int().min(1).optional(),
  date_from: z.coerce.date(),
  date_to: z.coerce.date(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorAppointmentSlotsSchema>
  >,
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

  const { result } = await createAppointmentSlotsWorkflow(req.scope).run({
    input: {
      provider_id: provider.id,
      service_product_id: req.validatedBody.service_product_id,
      service_variant_id: req.validatedBody.service_variant_id,
      service_duration_minutes: req.validatedBody.service_duration_minutes,
      max_capacity: req.validatedBody.max_capacity,
      date_from: req.validatedBody.date_from,
      date_to: req.validatedBody.date_to,
    },
  })

  res.json({ appointments: result })
}
