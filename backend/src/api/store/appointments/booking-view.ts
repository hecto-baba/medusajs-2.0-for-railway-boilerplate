import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { verifyCancelToken } from "../../../modules/appointment-booking/lib/cancel-token"
import type AppointmentBookingModuleService from "../../../modules/appointment-booking/service"

type Attendee = Awaited<ReturnType<AppointmentBookingModuleService["listAppointmentAttendees"]>>[number]

/**
 * Who may see or cancel a booking: the signed-in customer it belongs to, or the
 * holder of its signed link (guests). Anyone else gets 404, the same answer as
 * a booking that does not exist.
 */
export const assertBookingAccess = (req: MedusaRequest, attendee: Attendee): void => {
  const actorId = (req as any).auth_context?.actor_id as string | undefined
  if (actorId && attendee.customer_id && attendee.customer_id === actorId) return

  const token = typeof req.query.token === "string" ? req.query.token : undefined
  if (verifyCancelToken(attendee.id, token)) return

  throw new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
}

/**
 * Presentation of bookings for buyers. Built for a whole page at once: slots,
 * resources and product titles are each fetched in one query for every booking,
 * never per booking.
 */
export const buildBookingViews = async (
  req: MedusaRequest,
  service: AppointmentBookingModuleService,
  attendees: Attendee[],
  now: Date = new Date()
) => {
  if (!attendees.length) return []

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const appointments = await service.listAppointments(
    { id: [...new Set(attendees.map((a) => a.appointment_id))] },
    { take: null }
  )
  const appointmentById = new Map(appointments.map((a) => [a.id, a]))

  const resources = await service.listProviders(
    { id: [...new Set(appointments.map((a) => a.provider_id))] },
    {
      select: ["id", "display_name", "timezone", "cancellation_window_hours", "vendor_id"],
      take: null,
    }
  )
  const resourceById = new Map(resources.map((r) => [r.id, r]))

  const titles = new Map<string, string>()
  const productIds = [...new Set(appointments.map((a) => a.service_product_id))]
  if (productIds.length) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "title"],
      filters: { id: productIds },
    })
    for (const p of products as any[]) titles.set(p.id, p.title)
  }

  return attendees.flatMap((attendee) => {
    const appointment = appointmentById.get(attendee.appointment_id)
    if (!appointment) return []
    const resource = resourceById.get(appointment.provider_id)

    const start = new Date(appointment.start_time)
    const deadline = new Date(
      start.getTime() - (resource?.cancellation_window_hours ?? 24) * 3_600_000
    )
    const active = attendee.status === "confirmed" || attendee.status === "reserved"

    return [
      {
        id: attendee.id,
        status: attendee.status,
        order_id: attendee.order_id ?? null,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        resource: {
          id: appointment.provider_id,
          name: resource?.display_name ?? null,
          timezone: appointment.resource_timezone ?? resource?.timezone ?? null,
        },
        service: {
          product_id: appointment.service_product_id,
          title: titles.get(appointment.service_product_id) ?? null,
        },
        buyer_name: attendee.buyer_name ?? null,
        cancel_deadline: deadline.toISOString(),
        can_cancel: active && now.getTime() <= deadline.getTime() && start.getTime() > now.getTime(),
        cancelled_by: attendee.cancelled_by ?? null,
      },
    ]
  })
}
