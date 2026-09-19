import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../modules/appointment-booking/service"

export const GetAvailableSlotsSchema = z.object({
  service_duration_minutes: z.coerce.number().int().min(1),
  date_from: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "date_from must be a valid date string",
  }),
  date_to: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "date_to must be a valid date string",
  }),
})

/**
 * Read-only slot computation, straight from the module service - no
 * workflow needed since nothing is written. Mirrors the ticket seats route's
 * "call the service directly from a store route" pattern.
 */
export const GET = async (
  req: MedusaRequest<{}, z.infer<typeof GetAvailableSlotsSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { service_duration_minutes, date_from, date_to } = req.validatedQuery

  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const slots = await service.expandAvailableSlots(
    id,
    service_duration_minutes,
    new Date(date_from),
    new Date(date_to)
  )

  res.json({ slots })
}
