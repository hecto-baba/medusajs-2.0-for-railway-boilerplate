import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createRecurringAvailabilityWorkflow } from "../../../../../workflows/create-recurring-availability"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: recurring_availabilities } = await query.graph({
    entity: "recurring_availability",
    fields: ["*"],
    filters: { provider_id: id },
  })

  res.json({ recurring_availabilities })
}

export const PostAdminRecurringAvailabilitySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  effective_from: z.coerce.date(),
  effective_until: z.coerce.date().nullable().optional(),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostAdminRecurringAvailabilitySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params

  const { result } = await createRecurringAvailabilityWorkflow(req.scope).run({
    input: {
      provider_id: id,
      day_of_week: req.validatedBody.day_of_week,
      start_time: req.validatedBody.start_time,
      end_time: req.validatedBody.end_time,
      effective_from: req.validatedBody.effective_from,
      effective_until: req.validatedBody.effective_until,
    },
  })

  res.json({ recurring_availability: result })
}
