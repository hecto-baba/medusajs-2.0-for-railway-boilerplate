import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import type AppointmentBookingModuleService from "../service"
import { hhmmToMinutes, localToUtcMs, addLocalDays } from "./timezone"
import { isUniqueViolation } from "./db-errors"

/**
 * Operations shared by the seller routes (scoped to the vendor's own resources)
 * and the admin routes (any resource). The routes decide WHO may act on WHICH
 * resource; everything here assumes that has already been settled.
 */

/** Live (confirmed, or held and not yet expired) attendees in a time window. */
export const countLiveBookingsInWindow = async (
  service: AppointmentBookingModuleService,
  resource: { id: string; timezone: string },
  date: Date,
  startTime?: string | null,
  endTime?: string | null
): Promise<number> => {
  const [y, m, d] = date.toISOString().slice(0, 10).split("-").map(Number)
  const day = { year: y, month: m, day: d }
  const tz = resource.timezone

  const windowStart = startTime
    ? localToUtcMs(day, hhmmToMinutes(startTime), tz)
    : localToUtcMs(day, 0, tz)
  const windowEnd = endTime
    ? localToUtcMs(day, hhmmToMinutes(endTime), tz)
    : localToUtcMs(addLocalDays(day, 1), 0, tz)

  const overlapping = await service.listAppointments(
    {
      provider_id: resource.id,
      status: ["available", "booked"],
      start_time: { $lt: new Date(windowEnd) },
      end_time: { $gt: new Date(windowStart) },
    },
    { select: ["id"], take: null }
  )
  if (!overlapping.length) return 0

  const attendees = await service.listAppointmentAttendees(
    { appointment_id: overlapping.map((a) => a.id), status: ["reserved", "confirmed"] },
    { select: ["id", "status", "expires_at"], take: null }
  )

  const now = Date.now()
  return attendees.filter(
    (a) =>
      a.status === "confirmed" ||
      (a.expires_at ? new Date(a.expires_at).getTime() > now : true)
  ).length
}

export type OfferingInput = {
  product_id: string
  duration_minutes?: number | null
  capacity?: number | null
}

/**
 * Sets the full list of services a resource offers, as a diff against what is
 * stored. Idempotent (the same list twice changes nothing), never re-creates an
 * existing row, and uses at most one create, one update and one delete per call.
 */
export const replaceOfferings = async (
  service: AppointmentBookingModuleService,
  resource: { id: string; session_duration_minutes: number },
  services: OfferingInput[]
) => {
  const wanted = new Map(services.map((s) => [s.product_id, s]))

  const apply = async () => {
    const existing = await service.listServiceProviders(
      { provider_id: resource.id },
      { take: null }
    )
    const existingByProduct = new Set(existing.map((e) => e.service_product_id))

    const toCreate = [...wanted.values()]
      .filter((s) => !existingByProduct.has(s.product_id))
      .map((s) => ({
        provider_id: resource.id,
        service_product_id: s.product_id,
        // Legacy column is NOT NULL; keep it populated with the effective length.
        default_duration_minutes: s.duration_minutes ?? resource.session_duration_minutes,
        duration_minutes: s.duration_minutes ?? null,
        capacity: s.capacity ?? null,
      }))

    const toUpdate = existing.flatMap((e) => {
      const s = wanted.get(e.service_product_id)
      if (!s) return []
      const duration = s.duration_minutes ?? null
      const capacity = s.capacity ?? null
      if ((e.duration_minutes ?? null) === duration && (e.capacity ?? null) === capacity) {
        return []
      }
      return [
        {
          id: e.id,
          default_duration_minutes: duration ?? resource.session_duration_minutes,
          duration_minutes: duration,
          capacity,
        },
      ]
    })

    const toDelete = existing
      .filter((e) => !wanted.has(e.service_product_id))
      .map((e) => e.id)

    if (toCreate.length) await service.createServiceProviders(toCreate)
    if (toUpdate.length) await service.updateServiceProviders(toUpdate)
    if (toDelete.length) await service.deleteServiceProviders(toDelete)
  }

  try {
    await apply()
  } catch (err) {
    // A concurrent save inserted a row between our read and write; the diff is
    // idempotent, so recompute once from fresh state.
    if (!isUniqueViolation(err)) throw err
    await apply()
  }
}

/** Offerings with their product titles/variants, using one product query. */
export const loadOfferings = async (
  container: MedusaContainer,
  service: AppointmentBookingModuleService,
  resourceId: string
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const offerings = await service.listServiceProviders(
    { provider_id: resourceId },
    { take: null }
  )
  if (!offerings.length) return []

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "thumbnail", "variants.id", "variants.title"],
    filters: { id: offerings.map((o) => o.service_product_id) },
  })
  const byId = new Map((products as any[]).map((p) => [p.id, p]))

  return offerings.map((o) => ({
    id: o.id,
    product_id: o.service_product_id,
    duration_minutes: o.duration_minutes ?? null,
    capacity: o.capacity ?? null,
    product: byId.get(o.service_product_id) ?? null,
  }))
}

export type BookingListOptions = {
  providerIds: string[]
  status: "upcoming" | "past" | "all"
  from?: Date
  to?: Date
  limit: number
  offset: number
  /** Newest bookings first (by when they were made) instead of by start time. */
  recent?: boolean
}

/**
 * One page of confirmed bookings (one row per slot, with its attendees), built
 * with a fixed number of queries regardless of page size: the page of slots,
 * every attendee of the page in one query, every resource and every product
 * title in one query each. Only booked/completed slots are listed - held-but-
 * unpaid places and emptied slots are not bookings.
 */
export const listBookings = async (
  container: MedusaContainer,
  service: AppointmentBookingModuleService,
  opts: BookingListOptions
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  if (!opts.providerIds.length) {
    return { appointments: [], count: 0 }
  }

  const now = new Date()
  const filters: Record<string, any> = {
    provider_id: opts.providerIds,
    status: ["booked", "completed"],
  }
  if (opts.status === "upcoming") filters.end_time = { $gt: now }
  if (opts.status === "past") filters.end_time = { $lte: now }
  if (opts.from || opts.to) {
    filters.start_time = {
      ...(opts.from ? { $gte: opts.from } : {}),
      ...(opts.to ? { $lt: opts.to } : {}),
    }
  }

  const [appointments, count] = await service.listAndCountAppointments(filters, {
    take: opts.limit,
    skip: opts.offset,
    order: opts.recent
      ? { created_at: "DESC" }
      : { start_time: opts.status === "upcoming" ? "ASC" : "DESC" },
  })

  const [attendees, resources, products] = await Promise.all([
    appointments.length
      ? service.listAppointmentAttendees(
          { appointment_id: appointments.map((a) => a.id) },
          { take: null, order: { created_at: "ASC" } }
        )
      : Promise.resolve([]),
    appointments.length
      ? service.listProviders(
          { id: [...new Set(appointments.map((a) => a.provider_id))] },
          { select: ["id", "display_name", "timezone", "vendor_id"], take: null }
        )
      : Promise.resolve([]),
    appointments.length
      ? query
          .graph({
            entity: "product",
            fields: ["id", "title"],
            filters: { id: [...new Set(appointments.map((a) => a.service_product_id))] },
          })
          .then((r) => r.data as any[])
      : Promise.resolve([] as any[]),
  ])

  const attendeesByAppointment = new Map<string, typeof attendees>()
  for (const a of attendees) {
    const list = attendeesByAppointment.get(a.appointment_id) ?? []
    list.push(a)
    attendeesByAppointment.set(a.appointment_id, list)
  }
  const resourceById = new Map(resources.map((r) => [r.id, r]))
  const titleById = new Map(products.map((p) => [p.id, p.title as string]))

  return {
    count,
    appointments: appointments.map((a) => ({
      id: a.id,
      start_time: a.start_time,
      end_time: a.end_time,
      status: a.status,
      max_capacity: a.max_capacity,
      resource: {
        id: a.provider_id,
        display_name: resourceById.get(a.provider_id)?.display_name ?? null,
        timezone: a.resource_timezone ?? resourceById.get(a.provider_id)?.timezone ?? null,
        vendor_id: resourceById.get(a.provider_id)?.vendor_id ?? null,
      },
      service: {
        product_id: a.service_product_id,
        title: titleById.get(a.service_product_id) ?? null,
      },
      attendees: (attendeesByAppointment.get(a.id) ?? []).map((t) => ({
        id: t.id,
        status: t.status,
        buyer_name: t.buyer_name,
        buyer_email: t.buyer_email,
        buyer_phone: t.buyer_phone,
        notes: t.notes,
        order_id: t.order_id,
        cancelled_by: t.cancelled_by,
        cancel_reason: t.cancel_reason,
        rescheduled_from_start: t.rescheduled_from_start ?? null,
        rescheduled_by: t.rescheduled_by ?? null,
        reschedule_count: t.reschedule_count ?? 0,
      })),
    })),
  }
}

/** Marks a booked slot completed. Shared rules for vendor and admin. */
export const completeAppointment = async (
  service: AppointmentBookingModuleService,
  appointment: { id: string; status: string; start_time: Date | string }
) => {
  if (appointment.status === "completed") return appointment
  if (appointment.status !== "booked") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Only a booked appointment can be marked completed."
    )
  }
  if (new Date(appointment.start_time).getTime() > Date.now()) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This appointment has not started yet.")
  }
  return service.updateAppointments({ id: appointment.id, status: "completed" })
}
