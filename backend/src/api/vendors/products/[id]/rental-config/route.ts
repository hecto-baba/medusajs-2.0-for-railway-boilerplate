import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { upsertRentalConfigWorkflow } from "../../../../../workflows/upsert-rental-config"
import { assertOwnership } from "../../helpers"

/**
 * Rental settings for one of the vendor's products.
 *
 * The admin has the same pair of handlers under /admin/products/:id, but that
 * route takes the product id straight from the URL with no owner check - it
 * assumes the caller is a platform admin. This one runs assertOwnership first
 * so a vendor can only read or change the rental terms of their own products.
 *
 * The rental configuration itself carries no vendor field; it hangs off the
 * product through a module link, so the product's ownership is what decides
 * access here.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: rentalConfigs } = await query.graph({
    entity: "rental_configuration",
    fields: ["*"],
    filters: { product_id: id },
  })

  // null rather than 404 when there is none: "this product is not rentable"
  // is a normal state the panel renders, not an error.
  res.json({ rental_config: rentalConfigs[0] ?? null })
}

export const PostVendorRentalConfigSchema = z.object({
  min_rental_days: z.number().int().min(1).optional(),
  max_rental_days: z.number().int().min(1).nullable().optional(),
  rental_unit: z.enum(["hour", "day", "week", "month", "custom"]).optional(),
  min_rental_units: z.number().int().min(1).optional(),
  max_rental_units: z.number().int().min(1).nullable().optional(),
  security_deposit_amount: z.number().min(0).optional(),
  security_deposit_type: z.enum(["fixed", "percentage"]).optional(),
  requires_time_selection: z.boolean().optional(),
  fulfilment_modes: z.enum(["both", "pickup", "delivery"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorRentalConfigSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

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
      fulfilment_modes: req.validatedBody.fulfilment_modes,
      status: req.validatedBody.status,
    },
  })

  res.json({ rental_config: result })
}
