import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { updateEnquiryStatusWorkflow } from "../../../../../workflows/update-enquiry-status"
import { assertVendorOwnsEnquiry } from "../../helpers"

export const PostVendorEnquiryStatusBodySchema = z.object({
  status: z.enum(["pending", "closed"]),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorEnquiryStatusBodySchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsEnquiry(req, id)

  const { result } = await updateEnquiryStatusWorkflow(req.scope).run({
    input: {
      enquiry_id: id,
      status: req.validatedBody.status,
    },
  })

  res.json({ enquiry: result })
}
