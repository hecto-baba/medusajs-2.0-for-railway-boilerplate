import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { countLiveBookingsInWindow } from "../../../../../modules/appointment-booking/lib/resource-ops"
import { createAvailabilityExceptionWorkflow } from "../../../../../workflows/create-availability-exception"
import { assertResourceOwned, getAppointmentService } from "../../helpers"
import { PostExceptionSchema } from "../../schemas"

/** Holidays, partial time-off ("blocked slots") and extra hours, soonest first. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)

  const exceptions = await service.listAvailabilityExceptions(
    { provider_id: resource.id },
    { take: null, order: { date: "ASC" } }
  )

  res.json({ availability_exceptions: exceptions })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostExceptionSchema>>,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)
  const body = req.validatedBody

  // Closing time that already has customers booked would silently strand them.
  // The seller has to cancel those bookings first (each one is a deliberate,
  // visible action), then block the time.
  if (body.type === "blackout") {
    const live = await countLiveBookingsInWindow(
      service,
      resource,
      body.date,
      body.start_time,
      body.end_time
    )
    if (live) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${live} booking(s) already exist in this time. Cancel them first, then block it.`
      )
    }
  }

  const { result } = await createAvailabilityExceptionWorkflow(req.scope).run({
    input: { ...body, provider_id: resource.id },
  })

  res.status(201).json({ availability_exception: result })
}
