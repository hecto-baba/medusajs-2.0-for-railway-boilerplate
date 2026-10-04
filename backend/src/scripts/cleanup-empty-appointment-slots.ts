import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../modules/appointment-booking"
import type AppointmentBookingModuleService from "../modules/appointment-booking/service"

/**
 * One-off, OPTIONAL: removes the pre-generated, never-booked slots left over
 * from the old "generate slots" approach.
 *
 *   npx medusa exec ./src/scripts/cleanup-empty-appointment-slots.ts
 *
 * Slots are now computed live, so a stored "available" row with no attendees
 * does nothing useful - and a leftover one whose length differs from today's
 * session length would block the times it overlaps. Deletes only rows that are
 * "available" AND have no attendees at all; anything with a booking, a hold or
 * a history is left alone. Soft-deletes (recoverable). Idempotent.
 *
 * Deliberately a script and not part of the migration: it changes data, so it
 * should be run on purpose, once you have confirmed which database you are on.
 */
export default async function cleanupEmptyAppointmentSlots({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service: AppointmentBookingModuleService = container.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const BATCH = 500
  let removed = 0
  // Rows that are kept (they have attendees) stay in the result set, so the
  // window moves past them; deleted rows drop out of it and need no skip.
  let skip = 0

  for (;;) {
    const candidates = await service.listAppointments(
      { status: "available" },
      { select: ["id"], take: BATCH, skip, order: { created_at: "ASC", id: "ASC" } }
    )
    if (!candidates.length) break

    const withAttendees = await service.listAppointmentAttendees(
      { appointment_id: candidates.map((c) => c.id) },
      { select: ["id", "appointment_id"], take: null }
    )
    const occupied = new Set(withAttendees.map((a) => a.appointment_id))
    const empty = candidates.filter((c) => !occupied.has(c.id)).map((c) => c.id)

    if (empty.length) {
      await service.softDeleteAppointments(empty)
      removed += empty.length
    }

    skip += candidates.length - empty.length

    if (candidates.length < BATCH) break
  }

  logger.info(`[cleanup] removed ${removed} empty pre-generated slot(s)`)
}
