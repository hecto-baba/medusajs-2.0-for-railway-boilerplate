import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../modules/appointment-booking/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const serviceProviders = await service.listServiceProviders({
    service_product_id: id,
  })

  res.json({ service_providers: serviceProviders })
}

export const PostAppointmentConfigBodySchema = z.object({
  provider_ids: z.array(z.string()),
  default_duration_minutes: z.number().int().min(1),
})

/**
 * Replaces the full set of providers offering this product as a service, in
 * one call - simpler for the widget's multi-select than separate add/remove
 * endpoints, and there's no ordering or history to preserve here.
 *
 * Creates the new rows before deleting the old ones (not the reverse): if
 * createServiceProviders fails partway through, the product keeps its
 * previous, valid provider assignments instead of being silently left with
 * none. This isn't a real transaction, so a failure between create and
 * delete can still leave both old and new rows present momentarily - but
 * that's a duplicate-data problem an admin can see and re-save to fix,
 * rather than a product that quietly stopped being bookable.
 */
export const POST = async (
  req: MedusaRequest<z.infer<typeof PostAppointmentConfigBodySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { provider_ids, default_duration_minutes } = req.validatedBody

  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const existing = await service.listServiceProviders({
    service_product_id: id,
  })

  const created = provider_ids.length
    ? await service.createServiceProviders(
        provider_ids.map((provider_id) => ({
          provider_id,
          service_product_id: id,
          default_duration_minutes,
        }))
      )
    : []

  if (existing.length) {
    await service.deleteServiceProviders(existing.map((sp) => sp.id))
  }

  res.json({ service_providers: created })
}
