import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const BATCH_SIZE = 500
const MAX_BATCHES_PER_RUN = 10

/**
 * Frees places held by buyers who never finished paying.
 *
 * A hold is an attendee in "reserved" with an expires_at. Once that passes, the
 * place goes back on sale and the slot's status is recomputed from whoever is
 * left: a slot with other bookings stays booked; a slot whose only occupant was
 * the lapsed hold is closed (which also frees its time, because the overlap
 * constraint ignores cancelled rows).
 *
 * Done in guarded SQL, not read-then-write through the ORM, because it races two
 * other writers:
 *   - checkout extends a hold (validate-appointment-holds) and confirms it
 *     (confirm-appointment-attendees). Every update here re-states the condition
 *     it relied on (status is still 'reserved' AND still expired), so a hold that
 *     was extended or confirmed a moment ago simply no longer matches and is left
 *     alone - it can never cancel a paid attendee.
 *   - another buyer joining a slot. The slot update only closes a slot when NO
 *     live attendee remains at the instant it runs, evaluated in the same
 *     statement, so it cannot close a slot someone has just joined.
 * `for update skip locked` also makes two overlapping job runs split the work
 * instead of fighting over the same rows.
 *
 * A fixed handful of statements per batch regardless of how many holds expired.
 * Safe to run repeatedly and concurrently.
 */
const LIVE_ATTENDEE = `
  t.deleted_at is null
  and t.status != 'cancelled'
  and not (t.status = 'reserved' and t.expires_at is not null and t.expires_at <= now())
`

export default async function releaseAppointmentHolds(container: MedusaContainer) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = container.resolve("logger")

  let released = 0

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const { rows } = await pg.raw(
      `
      update appointment_attendee
         set status = 'cancelled',
             cancelled_at = now(),
             cancelled_by = 'system',
             cancel_reason = 'Hold expired before payment',
             expires_at = null,
             updated_at = now()
       where id in (
               select id from appointment_attendee
                where status = 'reserved'
                  and expires_at is not null
                  and expires_at < now()
                  and deleted_at is null
                order by expires_at
                limit ?
                  for update skip locked
             )
         and status = 'reserved'
         and expires_at < now()
      returning id, appointment_id
      `,
      [BATCH_SIZE]
    )

    if (!rows.length) break

    const appointmentIds = [...new Set<string>(rows.map((r: any) => r.appointment_id))]

    // Nobody live left -> the slot is empty again: close it (keeps the row for
    // history, frees the time).
    await pg.raw(
      `
      update appointment a
         set status = 'cancelled', order_id = null, updated_at = now()
       where a.id = any(?)
         and a.status in ('available', 'booked')
         and a.deleted_at is null
         and not exists (
               select 1 from appointment_attendee t
                where t.appointment_id = a.id and ${LIVE_ATTENDEE}
             )
      `,
      [appointmentIds]
    )

    // Only held places remain (no confirmed attendee) -> not "booked" any more.
    await pg.raw(
      `
      update appointment a
         set status = 'available', order_id = null, updated_at = now()
       where a.id = any(?)
         and a.status = 'booked'
         and a.deleted_at is null
         and not exists (
               select 1 from appointment_attendee t
                where t.appointment_id = a.id
                  and t.deleted_at is null
                  and t.status = 'confirmed'
             )
      `,
      [appointmentIds]
    )

    released += rows.length

    if (rows.length < BATCH_SIZE) break
  }

  if (released) {
    logger.info(`[appointments] released ${released} expired hold(s)`)
  }
}

export const config = {
  name: "release-appointment-holds",
  schedule: "* * * * *",
}
