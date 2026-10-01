import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { updateEnquiryStatusWorkflow } from "../../../../../workflows/update-enquiry-status"

export const PostAdminEnquiryStatusBodySchema = z.object({
  status: z.enum(["pending", "closed"]),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostAdminEnquiryStatusBodySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { status } = req.validatedBody

  const { result } = await updateEnquiryStatusWorkflow(req.scope).run({
    input: {
      enquiry_id: id,
      status,
    },
  })

  res.json({ enquiry: result })
}
