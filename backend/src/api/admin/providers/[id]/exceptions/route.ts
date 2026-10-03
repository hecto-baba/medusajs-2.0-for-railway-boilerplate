import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { countLiveBookingsInWindow } from "../../../../../modules/appointment-booking/lib/resource-ops"
import { createAvailabilityExceptionWorkflow } from "../../../../../workflows/create-availability-exception"
import { getService, loadResource } from "../../helpers"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const availability_exceptions = await getService(req).listAvailabilityExceptions(
    { provider_id: id },
    { take: null, order: { date: "ASC" } }
  )

  res.json({ availability_exceptions })
}

export const PostAdminAvailabilityExceptionSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["blackout", "extra_hours"]),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostAdminAvailabilityExceptionSchema>>,
  res: MedusaResponse
) => {
  const resource = await loadResource(req, req.params.id)
  const body = req.validatedBody

  // Same rule as for sellers: time that already has customers booked cannot be
  // closed until those bookings are cancelled.
  if (body.type === "blackout") {
    const live = await countLiveBookingsInWindow(
      getService(req),
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
    input: {
      provider_id: resource.id,
      date: body.date,
      type: body.type,
      start_time: body.start_time,
      end_time: body.end_time,
      reason: body.reason,
    },
  })

  res.json({ availability_exception: result })
}
