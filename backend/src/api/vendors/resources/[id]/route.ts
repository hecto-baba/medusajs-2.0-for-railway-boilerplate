import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  assertResourceOwned,
  computeReadiness,
  getAppointmentService,
} from "../helpers"
import { isUniqueViolation } from "../../../../modules/appointment-booking/lib/db-errors"
import { UpdateResourceSchema } from "../schemas"


export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)
  const readiness = await computeReadiness(service, [resource])

  res.json({ resource: { ...resource, readiness: readiness.get(resource.id) } })
}

/** Edit the profile and booking rules. Only the supplied fields change. */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateResourceSchema>>,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)

  const changes = Object.fromEntries(
    Object.entries(req.validatedBody).filter(([, v]) => v !== undefined)
  )

  if (!Object.keys(changes).length) {
    res.json({ resource })
    return
  }

  try {
    const updated = await service.updateProviders({ id: resource.id, ...changes })
    res.json({ resource: updated })
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "You already have a resource with this name."
      )
    }
    throw err
  }
}

/**
 * Removes a resource. Refused while it still has upcoming bookings or holds -
 * the seller must cancel those first, so no customer is left with a booking on a
 * resource that no longer exists.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)
  const now = new Date()

  const upcoming = await service.listAppointments(
    {
      provider_id: resource.id,
      status: ["available", "booked"],
      end_time: { $gt: now },
    },
    { select: ["id"], take: null }
  )

  if (upcoming.length) {
    const [live] = await service.listAppointmentAttendees(
      {
        appointment_id: upcoming.map((a) => a.id),
        status: ["reserved", "confirmed"],
      },
      { select: ["id", "status", "expires_at"], take: 1 }
    )
    if (live) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This resource has upcoming bookings. Cancel them first, or mark the resource inactive instead."
      )
    }
  }

  await service.softDeleteProviders(resource.id)

  res.json({ id: resource.id, deleted: true })
}
