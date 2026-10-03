import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../modules/appointment-booking/service"
import { createRecurringAvailabilityWorkflow } from "../../../../../workflows/create-recurring-availability"

async function requireOwnProviderId(req: AuthenticatedMedusaRequest) {
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

  return provider.id
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const providerId = await requireOwnProviderId(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: recurring_availabilities } = await query.graph({
    entity: "recurring_availability",
    fields: ["*"],
    filters: { provider_id: providerId },
  })

  res.json({ recurring_availabilities })
}

export const PostVendorRecurringAvailabilitySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  effective_from: z.coerce.date(),
  effective_until: z.coerce.date().nullable().optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorRecurringAvailabilitySchema>
  >,
  res: MedusaResponse
) => {
  const providerId = await requireOwnProviderId(req)

  const { result } = await createRecurringAvailabilityWorkflow(req.scope).run({
    input: {
      provider_id: providerId,
      day_of_week: req.validatedBody.day_of_week,
      start_time: req.validatedBody.start_time,
      end_time: req.validatedBody.end_time,
      effective_from: req.validatedBody.effective_from,
      effective_until: req.validatedBody.effective_until,
    },
  })

  res.json({ recurring_availability: result })
}
