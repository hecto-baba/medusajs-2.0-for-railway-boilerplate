import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../modules/appointment-booking/service"
import { isValidTimeZone } from "../../../../modules/appointment-booking/lib/timezone"
import { resolveVendorId } from "../../resources/helpers"

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
  timezone: z
    .string()
    .refine(isValidTimeZone, { message: "Must be a valid IANA timezone, e.g. Asia/Kolkata" }),
})

/**
 * Legacy single-profile route, kept until the sellers panel moves to
 * /vendors/resources. It now stamps the owning vendor on what it creates so the
 * profile is a first-class resource (owned by the business, not just the login).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostVendorProviderSchema>>,
  res: MedusaResponse
) => {
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const existing = await service.listProviders(
    { vendor_admin_id: req.auth_context.actor_id },
    { take: 1, order: { created_at: "ASC" } }
  )

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
    vendor_id: await resolveVendorId(req),
    vendor_admin_id: req.auth_context.actor_id,
    display_name: req.validatedBody.display_name,
    bio: req.validatedBody.bio,
    timezone: req.validatedBody.timezone,
  })

  res.json({ provider })
}
