import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { respondToEnquiryWorkflow } from "../../../../workflows/respond-to-enquiry"
import { assertVendorOwnsEnquiry } from "../helpers"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsEnquiry(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: enquiries } = await query.graph({
    entity: "enquiry",
    fields: [
      "id",
      "product_id",
      "product.title",
      "customer_id",
      "customer_email",
      "message",
      "custom_field_answers",
      "custom_fields_snapshot",
      "reply",
      "status",
      "responded_at",
      "created_at",
      "updated_at",
    ],
    filters: { id },
  })

  res.json({ enquiry: enquiries[0] })
}

export const PostVendorEnquiryReplyBodySchema = z.object({
  reply: z.string().min(1),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorEnquiryReplyBodySchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsEnquiry(req, id)

  const { result } = await respondToEnquiryWorkflow(req.scope).run({
    input: {
      enquiry_id: id,
      reply: req.validatedBody.reply,
    },
  })

  res.json({ enquiry: result })
}
