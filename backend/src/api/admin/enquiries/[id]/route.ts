import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { respondToEnquiryWorkflow } from "../../../../workflows/respond-to-enquiry"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve("query")

  const { data: enquiries } = await query.graph({
    entity: "enquiry",
    fields: [
      "id",
      "product_id",
      "product.title",
      "customer_id",
      "customer_email",
      "message",
      "reply",
      "status",
      "responded_at",
      "created_at",
      "updated_at",
    ],
    filters: { id },
  })

  if (!enquiries?.length) {
    res.status(404).json({ message: "Enquiry not found." })
    return
  }

  res.json({ enquiry: enquiries[0] })
}

export const PostAdminEnquiryReplyBodySchema = z.object({
  reply: z.string().min(1),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostAdminEnquiryReplyBodySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { reply } = req.validatedBody

  const { result } = await respondToEnquiryWorkflow(req.scope).run({
    input: {
      enquiry_id: id,
      reply,
    },
  })

  res.json({ enquiry: result })
}
