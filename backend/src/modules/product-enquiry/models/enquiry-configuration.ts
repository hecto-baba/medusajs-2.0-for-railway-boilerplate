import { model } from "@medusajs/framework/utils"
import { EnquiryFieldDefinition } from "../../../utils/enquiry-field"

/**
 * One row per product, 1:1 (mirrors RentalConfiguration). A product is not
 * enquirable until an admin explicitly enables it here - status defaults to
 * "inactive", and createEnquiryWorkflow checks this before accepting any
 * submission (see docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md, Phase C.2).
 *
 * custom_fields is the admin-authored field schema, plain JSON - Medusa has
 * no dedicated form-builder primitive, so this uses the same model.json()
 * pattern Medusa core uses for `metadata`. Shape is EnquiryFieldDefinition[]
 * (see utils/enquiry-field.ts) - not DB-enforced, validated at the
 * API/workflow layer (validate-enquiry-fields.ts).
 */
const EnquiryConfiguration = model.define("enquiry_configuration", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  status: model.enum(["active", "inactive"]).default("inactive"),
  custom_fields: model.json<EnquiryFieldDefinition[]>().nullable(),
})

export default EnquiryConfiguration
