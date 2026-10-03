import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createAppointmentSlotsWorkflow } from "../../../../../workflows/create-appointment-slots"

export const PostAdminAppointmentSlotsSchema = z.object({
  service_product_id: z.string(),
  service_variant_id: z.string().nullable().optional(),
  service_duration_minutes: z.number().int().min(1),
  max_capacity: z.number().int().min(1).optional(),
  date_from: z.coerce.date(),
  date_to: z.coerce.date(),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostAdminAppointmentSlotsSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params

  const { result } = await createAppointmentSlotsWorkflow(req.scope).run({
    input: {
      provider_id: id,
      service_product_id: req.validatedBody.service_product_id,
      service_variant_id: req.validatedBody.service_variant_id,
      service_duration_minutes: req.validatedBody.service_duration_minutes,
      max_capacity: req.validatedBody.max_capacity,
      date_from: req.validatedBody.date_from,
      date_to: req.validatedBody.date_to,
    },
  })

  res.json({ appointments: result })
}
