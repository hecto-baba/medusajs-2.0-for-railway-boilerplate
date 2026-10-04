import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { listBookings } from "../../../modules/appointment-booking/lib/resource-ops"
import {
  isCapacityViolation,
  isExclusionViolation,
} from "../../../modules/appointment-booking/lib/db-errors"
import {
  assertResourceOwned,
  getAppointmentService,
  listOwnedResourceIds,
} from "../resources/helpers"
import {
  CreateManualAppointmentSchema,
  GetVendorAppointmentsSchema,
} from "../resources/schemas"

/**
 * The vendor's confirmed bookings, one row per time slot with its attendees (a
 * group slot has several), paginated. See listBookings for the query budget.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service = getAppointmentService(req)
  const q = req.validatedQuery as z.infer<typeof GetVendorAppointmentsSchema>

  const owned = await listOwnedResourceIds(req)

  let providerIds = owned
  if (q.resource_id) {
    if (!owned.includes(q.resource_id)) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found.")
    }
    providerIds = [q.resource_id]
  }

  const { appointments, count } = await listBookings(req.scope, service, {
    providerIds,
    status: q.status,
    from: q.from,
    to: q.to,
    limit: q.limit,
    offset: q.offset,
  })

  res.json({ appointments, count, limit: q.limit, offset: q.offset })
}

const SLOT_TAKEN = "That time is no longer available. Please choose another time."

/**
 * Records a booking the seller enters by hand (phone call, walk-in).
 *
 * It takes the same slot a buyer would, through the same availability check, so
 * hours, holidays, buffers and capacity all still apply and a manual booking can
 * never double-book a time. The difference is that nothing is charged here: the
 * place is confirmed straight away with no order attached, so no payment or
 * refund exists for it, and the confirmation email is not sent.
 *
 * The notice window is waived (a walk-in is usually "now"); a start in the past
 * is refused.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateManualAppointmentSchema>>,
  res: MedusaResponse
) => {
  const body = req.validatedBody
  const resource = await assertResourceOwned(req, body.resource_id)
  const service = getAppointmentService(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const realNow = new Date()
  if (body.start.getTime() < realNow.getTime() - 60_000) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That time is in the past.")
  }
  // Waives only the minimum-notice rule: a start closer than the notice window
  // is judged as if it were being booked just before it.
  const now = new Date(Math.min(realNow.getTime(), body.start.getTime() - 1000))

  const { slot, ctx } = await service.findBookableSlotAt({
    provider_id: resource.id,
    product_id: body.product_id,
    start: body.start,
    now,
  })
  if (!slot) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, SLOT_TAKEN)
  }

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id"],
    filters: { id: [body.product_id] },
  })
  const variantId = (product as any)?.variants?.[0]?.id as string | undefined
  if (!variantId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That service has no variant to book.")
  }

  let appointmentId = slot.appointment_id ?? null
  let createdAppointment = false

  if (!appointmentId) {
    try {
      const appointment = await service.createAppointments({
        provider_id: resource.id,
        service_product_id: body.product_id,
        service_variant_id: variantId,
        start_time: slot.start,
        end_time: slot.end,
        max_capacity: slot.capacity,
        buffer_before_minutes: ctx.provider.buffer_before_minutes,
        buffer_after_minutes: ctx.provider.buffer_after_minutes,
        resource_timezone: ctx.provider.timezone,
        status: "booked",
      })
      appointmentId = appointment.id
      createdAppointment = true
    } catch (err: any) {
      if (isExclusionViolation(err)) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, SLOT_TAKEN)
      }
      throw err
    }
  }

  try {
    const attendee = await service.createAppointmentAttendees({
      appointment_id: appointmentId,
      customer_id: null,
      buyer_name: body.name,
      buyer_email: body.email || null,
      buyer_phone: body.phone || null,
      notes: body.notes || null,
      status: "confirmed",
      expires_at: null,
    })

    if (!createdAppointment) {
      // Joining a slot that only had holds (status "available"): it is booked now.
      await service.updateAppointments({ id: appointmentId, status: "booked" })
    }

    res.status(201).json({
      booking: { attendee_id: attendee.id, appointment_id: appointmentId },
    })
  } catch (err: any) {
    if (createdAppointment && appointmentId) {
      await service.deleteAppointments(appointmentId).catch(() => {})
    }
    if (isCapacityViolation(err)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, SLOT_TAKEN)
    }
    throw err
  }
}
