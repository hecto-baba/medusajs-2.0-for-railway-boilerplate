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
      status: req.validatedBody.status,
    },
  })

  res.json({ rental_config: result })
}
