import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createRecurringAvailabilityWorkflow } from "../../../../../workflows/create-recurring-availability"
import { assertResourceOwned, getAppointmentService } from "../../helpers"
import { PostHoursSchema } from "../../schemas"

/** Weekly working hours for the resource, ordered by weekday then start time. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)

  const hours = await service.listRecurringAvailabilities(
    { provider_id: resource.id },
    { take: null, order: { day_of_week: "ASC", start_time: "ASC" } }
  )

  res.json({ hours })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostHoursSchema>>,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)

  // Validation, overlap rejection and idempotency live in the workflow step, so
  // the admin routes get exactly the same behaviour.
  const { result } = await createRecurringAvailabilityWorkflow(req.scope).run({
    input: { ...req.validatedBody, provider_id: resource.id },
  })

  res.status(201).json({ hours: result })
}
