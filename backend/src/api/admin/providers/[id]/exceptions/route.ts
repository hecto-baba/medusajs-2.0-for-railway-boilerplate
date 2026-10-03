import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createAvailabilityExceptionWorkflow } from "../../../../../workflows/create-availability-exception"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: availability_exceptions } = await query.graph({
    entity: "availability_exception",
    fields: ["*"],
    filters: { provider_id: id },
  })

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
  const { id } = req.params

  const { result } = await createAvailabilityExceptionWorkflow(req.scope).run({
    input: {
      provider_id: id,
      date: req.validatedBody.date,
      type: req.validatedBody.type,
      start_time: req.validatedBody.start_time,
      end_time: req.validatedBody.end_time,
      reason: req.validatedBody.reason,
    },
  })

  res.json({ availability_exception: result })
}
