import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../modules/appointment-booking/service"

/**
 * Fetch-or-create the calling vendor admin's own Provider row, mirroring
 * /vendors/me's actor_id scoping - a provider is created lazily the first
 * time a staff member touches their schedule, rather than requiring a
 * separate signup step.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [provider],
  } = await query.graph({
    entity: "provider",
    fields: ["*"],
    filters: { vendor_admin_id: req.auth_context.actor_id },
  })

  res.json({ provider: provider ?? null })
}

export const PostVendorProviderSchema = z.object({
  display_name: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  timezone: z.string(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostVendorProviderSchema>>,
  res: MedusaResponse
) => {
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const existing = await service.listProviders({
    vendor_admin_id: req.auth_context.actor_id,
  })

  if (existing.length) {
    const updated = await service.updateProviders({
      id: existing[0].id,
      display_name: req.validatedBody.display_name,
      bio: req.validatedBody.bio,
      timezone: req.validatedBody.timezone,
    })

    res.json({ provider: updated })
    return
  }

  const provider = await service.createProviders({
    vendor_admin_id: req.auth_context.actor_id,
    display_name: req.validatedBody.display_name,
    bio: req.validatedBody.bio,
    timezone: req.validatedBody.timezone,
  })

  res.json({ provider })
}
