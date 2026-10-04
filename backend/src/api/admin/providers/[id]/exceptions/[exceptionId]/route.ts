import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { validateException } from "../../../../../../modules/appointment-booking/lib/availability"
import { isUniqueViolation } from "../../../../../../modules/appointment-booking/lib/db-errors"
import { countLiveBookingsInWindow } from "../../../../../../modules/appointment-booking/lib/resource-ops"
import { PostAdminAvailabilityExceptionSchema } from "../route"
import { loadResource } from "../../../helpers"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../../modules/appointment-booking/service"

/**
 * Removes one holiday / extra-hours exception. The exception must belong to the
 * provider in the URL - an id from another provider answers 404 exactly like an
 * id that does not exist, so the route cannot be used to probe or delete across
 * providers.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id, exceptionId } = req.params
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const [exception] = await service.listAvailabilityExceptions(
    { id: exceptionId, provider_id: id },
    { select: ["id"], take: 1 }
  )

  if (!exception) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Exception not found.")
  }

  await service.deleteAvailabilityExceptions(exceptionId)

  res.json({ id: exceptionId, deleted: true })
}

/** Edit an exception: change its date, kind, hours or reason. The body is the whole entry. */
export const POST = async (
  req: MedusaRequest<z.infer<typeof PostAdminAvailabilityExceptionSchema>>,
  res: MedusaResponse
) => {
  const { id, exceptionId } = req.params
  const resource = await loadResource(req, id)
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )
  const body = req.validatedBody

  const [exception] = await service.listAvailabilityExceptions(
    { id: exceptionId, provider_id: id },
    { take: 1 }
  )
  if (!exception) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Exception not found.")
  }

  const problem = validateException(body)
  if (problem) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
  }

  const date = new Date(`${new Date(body.date).toISOString().slice(0, 10)}T00:00:00.000Z`)
  const start_time = body.start_time || null
  const end_time = body.end_time || null

  if (body.type === "blackout") {
    const live = await countLiveBookingsInWindow(service, resource, date, start_time, end_time)
    if (live) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${live} booking(s) already exist in this time. Cancel them first, then block it.`
      )
    }
  }

  try {
    const updated = await service.updateAvailabilityExceptions({
      id: exception.id,
      date,
      type: body.type,
      start_time,
      end_time,
      reason: body.reason ?? null,
    })
    res.json({ availability_exception: updated })
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "An identical entry already exists for this date."
      )
    }
    throw err
  }
}
