import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { listBookings } from "../../../../modules/appointment-booking/lib/resource-ops"
import { getAppointmentService, listOwnedResourceIds } from "../../resources/helpers"

const DAY = 86_400_000
const RECENT = 5

/**
 * Everything the seller's Booking Overview needs in one call: the four headline
 * counts with their month-on-month change, and the most recent bookings.
 *
 *   active   - confirmed bookings not yet marked completed
 *   upcoming - booked times that have not finished
 *   past     - booked or completed times that have finished
 *   pending  - places held while a customer is paying (the hold has not run out)
 *
 * "change" is bookings made in the last 30 days minus those made in the 30 days
 * before, so it reads as "+N from last month". Counts are time slots, not
 * people: a group session counts once.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service = getAppointmentService(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const owned = await listOwnedResourceIds(req)

  if (!owned.length) {
    const zero = { count: 0, change: 0 }
    res.json({
      stats: { active: zero, upcoming: zero, past: { count: 0 }, pending: zero },
      recent: [],
    })
    return
  }

  const now = new Date()
  const thisMonth = { $gte: new Date(now.getTime() - 30 * DAY) }
  const lastMonth = {
    $gte: new Date(now.getTime() - 60 * DAY),
    $lt: new Date(now.getTime() - 30 * DAY),
  }

  const slots = (filters: Record<string, unknown>) =>
    service
      .listAndCountAppointments({ provider_id: owned, ...filters }, { take: 1, select: ["id"] })
      .then(([, count]) => count)

  const activeFilter = { status: "booked" }
  const upcomingFilter = { status: "booked", end_time: { $gt: now } }
  const pastFilter = { status: ["booked", "completed"], end_time: { $lte: now } }

  // Held places live on slots that are still ahead of us.
  const futureSlotIds = await service
    .listAppointments(
      { provider_id: owned, status: ["available", "booked"], end_time: { $gt: now } },
      { select: ["id"], take: null }
    )
    .then((rows) => rows.map((r) => r.id))

  const held = (extra: Record<string, unknown> = {}) =>
    futureSlotIds.length
      ? service
          .listAndCountAppointmentAttendees(
            {
              appointment_id: futureSlotIds,
              status: "reserved",
              expires_at: { $gt: now },
              ...extra,
            },
            { take: 1, select: ["id"] }
          )
          .then(([, count]) => count)
      : Promise.resolve(0)

  const [
    active,
    activeNow,
    activeBefore,
    upcoming,
    upcomingNow,
    upcomingBefore,
    past,
    pending,
    pendingNow,
    pendingBefore,
    recentPage,
  ] = await Promise.all([
    slots(activeFilter),
    slots({ ...activeFilter, created_at: thisMonth }),
    slots({ ...activeFilter, created_at: lastMonth }),
    slots(upcomingFilter),
    slots({ ...upcomingFilter, created_at: thisMonth }),
    slots({ ...upcomingFilter, created_at: lastMonth }),
    slots(pastFilter),
    held(),
    held({ created_at: thisMonth }),
    held({ created_at: lastMonth }),
    listBookings(req.scope, service, {
      providerIds: owned,
      status: "all",
      limit: RECENT,
      offset: 0,
      recent: true,
    }),
  ])

  // One row per person, newest booking first; the order supplies the amount.
  const rows = recentPage.appointments
    .flatMap((b) =>
      b.attendees
        .filter((a) => a.status !== "reserved")
        .map((a) => ({ booking: b, attendee: a }))
    )
    .slice(0, RECENT)

  const orderIds = [...new Set(rows.map((r) => r.attendee.order_id).filter(Boolean))] as string[]
  const orders = orderIds.length
    ? await query
        .graph({
          entity: "order",
          fields: ["id", "display_id", "total", "currency_code"],
          filters: { id: orderIds },
        })
        .then((r) => r.data as any[])
    : []
  const orderById = new Map(orders.map((o) => [o.id, o]))

  res.json({
    stats: {
      active: { count: active, change: activeNow - activeBefore },
      upcoming: { count: upcoming, change: upcomingNow - upcomingBefore },
      past: { count: past },
      pending: { count: await pending, change: (await pendingNow) - (await pendingBefore) },
    },
    recent: rows.map(({ booking, attendee }) => {
      const order = attendee.order_id ? orderById.get(attendee.order_id) : null
      return {
        id: attendee.id,
        booking_ref: attendee.id.slice(-6).toUpperCase(),
        order_id: attendee.order_id,
        order_display_id: order?.display_id ?? null,
        customer: attendee.buyer_name,
        start_time: booking.start_time,
        timezone: booking.resource.timezone,
        service: booking.service.title,
        resource: booking.resource.display_name,
        status:
          attendee.status === "cancelled"
            ? "cancelled"
            : booking.status === "completed"
              ? "completed"
              : "confirmed",
        amount: order?.total ?? null,
        currency_code: order?.currency_code ?? null,
      }
    }),
  })
}
