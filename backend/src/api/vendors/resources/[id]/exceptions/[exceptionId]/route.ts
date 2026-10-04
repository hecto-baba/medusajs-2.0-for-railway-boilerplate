import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { validateException } from "../../../../../../modules/appointment-booking/lib/availability"
import { isUniqueViolation } from "../../../../../../modules/appointment-booking/lib/db-errors"
import { countLiveBookingsInWindow } from "../../../../../../modules/appointment-booking/lib/resource-ops"
import { assertResourceOwned, getAppointmentService } from "../../../helpers"
import { PostExceptionSchema } from "../../../schemas"

/**
 * Edit a holiday / time-off / extra-hours entry: change its date, kind, hours or
 * reason. The body is the whole entry, same shape as creating one.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostExceptionSchema>>,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)
  const body = req.validatedBody

  const [exception] = await service.listAvailabilityExceptions(
    { id: req.params.exceptionId, provider_id: resource.id },
    { take: 1 }
  )
  if (!exception) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Exception not found.")
  }

  const problem = validateException(body)
  if (problem) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
  }

  // Calendar date, stored as UTC midnight (same as when it is created).
  const date = new Date(`${new Date(body.date).toISOString().slice(0, 10)}T00:00:00.000Z`)
  const start_time = body.start_time || null
  const end_time = body.end_time || null

  // Closing time that already has customers booked would strand them.
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

/** Removes a holiday / blocked slot / extra-hours entry ("unblock"). */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)

  const [exception] = await service.listAvailabilityExceptions(
    { id: req.params.exceptionId, provider_id: resource.id },
    { select: ["id"], take: 1 }
  )

  if (!exception) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Exception not found.")
  }

  await service.deleteAvailabilityExceptions(exception.id)

  res.json({ id: exception.id, deleted: true })
}
