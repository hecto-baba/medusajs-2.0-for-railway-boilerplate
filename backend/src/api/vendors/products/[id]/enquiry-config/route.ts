import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { upsertEnquiryConfigWorkflow } from "../../../../../workflows/upsert-enquiry-config"
import { PostEnquiryConfigBodySchema } from "../../../../admin/products/[id]/enquiry-config/route"
import { assertOwnership } from "../../helpers"

/**
 * Enquiry settings for one of the vendor's products.
 *
 * Same handlers as /admin/products/:id/enquiry-config, but behind
 * assertOwnership: the admin route takes the product id straight from the
 * URL and assumes a platform admin, so a vendor must never be pointed at it.
 * The body schema is the admin's own, so field validation cannot drift.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: configs } = await query.graph({
    entity: "enquiry_configuration",
    fields: ["*"],
    filters: { product_id: id },
  })

  // null rather than 404: "this product takes no enquiries" is a normal state
  // the panel renders, not an error.
  res.json({ enquiry_config: configs[0] ?? null })
}

export const PostVendorEnquiryConfigSchema = PostEnquiryConfigBodySchema

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostVendorEnquiryConfigSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const { result } = await upsertEnquiryConfigWorkflow(req.scope).run({
    input: {
      product_id: id,
      status: req.validatedBody.status,
      custom_fields: req.validatedBody.custom_fields as any,
    },
  })

  res.json({ enquiry_config: result })
}
