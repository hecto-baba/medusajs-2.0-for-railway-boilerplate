import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../modules/appointment-booking/service"
import { createAvailabilityExceptionWorkflow } from "../../../../../workflows/create-availability-exception"

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

  const { data: availability_exceptions } = await query.graph({
    entity: "availability_exception",
    fields: ["*"],
    filters: { provider_id: providerId },
  })

  res.json({ availability_exceptions })
}

export const PostVendorAvailabilityExceptionSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["blackout", "extra_hours"]),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorAvailabilityExceptionSchema>
  >,
  res: MedusaResponse
) => {
  const providerId = await requireOwnProviderId(req)

  const { result } = await createAvailabilityExceptionWorkflow(req.scope).run({
    input: {
      provider_id: providerId,
      date: req.validatedBody.date,
      type: req.validatedBody.type,
      start_time: req.validatedBody.start_time,
      end_time: req.validatedBody.end_time,
      reason: req.validatedBody.reason,
    },
  })

  res.json({ availability_exception: result })
}
