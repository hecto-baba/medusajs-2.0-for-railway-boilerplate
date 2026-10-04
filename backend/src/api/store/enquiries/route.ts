import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createEnquiryWorkflow } from "../../../workflows/create-enquiry"

export const PostStoreEnquirySchema = z.object({
  product_id: z.string().min(1).max(100),
  customer_email: z.string().email().max(254),
  message: z.string().min(1).max(2000),
  // Answers to the product's admin-configured custom fields, keyed by field
  // id. Validated against the product's active EnquiryConfiguration inside
  // createEnquiryWorkflow (not here) - this route has no way to know a
  // product's field schema without querying it, which the workflow already
  // does. See docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md, Phase D.2.
  custom_field_answers: z
    .record(
      z.string().max(100),
      z.union([z.string().max(2000), z.array(z.string().max(500)).max(50)])
    )
    .refine((answers) => Object.keys(answers).length <= 50, {
      message: "Too many custom field answers.",
    })
    .optional(),
})

/**
 * Public: any shopper (guest or logged in) can ask a question about a
 * product. /store/* is globally authenticated with allowUnauthenticated:
 * true (see @medusajs/framework/http/router.js), so req.auth_context is
 * present only when a customer session/bearer token was sent - never
 * required here.
 *
 * customer_id is deliberately taken from the session, never from the
 * request body: trusting a client-supplied customer_id would let anyone
 * attribute an enquiry to an arbitrary customer.
 */
export const POST = async (
  req: MedusaStoreRequest<z.infer<typeof PostStoreEnquirySchema>>,
  res: MedusaResponse
) => {
  const { product_id, customer_email, message, custom_field_answers } = req.validatedBody

  const customerId =
    req.auth_context?.actor_type === "customer" ? req.auth_context.actor_id : null

  const { result } = await createEnquiryWorkflow(req.scope).run({
    input: {
      product_id,
      customer_email,
      message,
      customer_id: customerId,
      custom_field_answers: custom_field_answers as Record<string, string | string[]> | undefined,
    },
  })

  res.status(201).json({ enquiry: result })
}
