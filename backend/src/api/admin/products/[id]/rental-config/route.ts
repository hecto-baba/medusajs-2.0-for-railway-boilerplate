import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { upsertRentalConfigWorkflow } from "../../../../../workflows/upsert-rental-config"
import { z } from "@medusajs/framework/zod"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve("query")

  // Query rental configuration for the product
  const { data: rentalConfigs } = await query.graph({
    entity: "rental_configuration",
    fields: ["*"],
    filters: { product_id: id },
  })

  res.json({ rental_config: rentalConfigs[0] })
}

export const PostRentalConfigBodySchema = z.object({
  min_rental_days: z.number().optional(),
  max_rental_days: z.number().nullable().optional(),
  rental_unit: z.enum(["hour", "day", "week", "month", "custom"]).optional(),
  min_rental_units: z.number().optional(),
  max_rental_units: z.number().nullable().optional(),
  security_deposit_amount: z.number().optional(),
  security_deposit_type: z.enum(["fixed", "percentage"]).optional(),
  requires_time_selection: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostRentalConfigBodySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params

  const { result } = await upsertRentalConfigWorkflow(req.scope).run({
    input: {
      product_id: id,
      min_rental_days: req.validatedBody.min_rental_days,
      max_rental_days: req.validatedBody.max_rental_days,
      rental_unit: req.validatedBody.rental_unit,
      min_rental_units: req.validatedBody.min_rental_units,
      max_rental_units: req.validatedBody.max_rental_units,
      security_deposit_amount: req.validatedBody.security_deposit_amount,
      security_deposit_type: req.validatedBody.security_deposit_type,
      requires_time_selection: req.validatedBody.requires_time_selection,
      status: req.validatedBody.status
    },
  })

  res.json({ rental_config: result })
}

