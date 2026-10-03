import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { upsertEnquiryConfigWorkflow } from "../../../../../workflows/upsert-enquiry-config"
import { ENQUIRY_FIELD_TYPES } from "../../../../../utils/enquiry-field"
import { validateEnquiryFieldDefinitions } from "../../../../../utils/validate-enquiry-fields"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve("query")

  const { data: configs } = await query.graph({
    entity: "enquiry_configuration",
    fields: ["*"],
    filters: { product_id: id },
  })

  res.json({ enquiry_config: configs[0] ?? null })
}

const EnquiryFieldDefinitionSchema = z
  .object({
    id: z.string(),
    type: z.enum(ENQUIRY_FIELD_TYPES),
    label: z.string().min(1),
    required: z.boolean(),
    order: z.number(),
    options: z.array(z.string()).optional(),
  })
  .array()
  // Same rules as validateEnquiryFieldDefinitions (unique ids, non-empty
  // options on choice types) - checked here too so a bad request is
  // rejected before the workflow runs, not just inside it.
  .refine(
    (fields) => {
      try {
        validateEnquiryFieldDefinitions(fields as any)
        return true
      } catch {
        return false
      }
    },
    { message: "Custom fields are invalid - check for duplicate ids or missing options." }
  )

export const PostEnquiryConfigBodySchema = z.object({
  status: z.enum(["active", "inactive"]).optional(),
  custom_fields: EnquiryFieldDefinitionSchema.optional(),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostEnquiryConfigBodySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params

  const { result } = await upsertEnquiryConfigWorkflow(req.scope).run({
    input: {
      product_id: id,
      status: req.validatedBody.status,
      custom_fields: req.validatedBody.custom_fields as any,
    },
  })

  res.json({ enquiry_config: result })
}
