import { model } from "@medusajs/framework/utils"
import { EnquiryFieldAnswers, EnquiryFieldDefinition } from "../../../utils/enquiry-field"

/**
 * A customer's pre-sales question about a specific product. Deliberately
 * carries no price, line item, or cart/order reference - an enquiry never
 * touches Cart, Payment, or Order (see docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN.md).
 *
 * product_id and customer_id are plain text fields, not relations: ownership
 * is expressed through module links (src/links/product-enquiry.ts,
 * src/links/customer-enquiry.ts) so this module stays isolated from Product
 * and Customer, per the module-links pattern used by rental/appointment-booking.
 *
 * custom_field_answers and custom_fields_snapshot are a pair, both added in
 * the ADMIN2 addendum (per-product enable + configurable fields):
 * custom_field_answers is what the customer submitted, keyed by field id.
 * custom_fields_snapshot is a copy of the EnquiryConfiguration.custom_fields
 * that was active at submission time - captured so an admin later renaming
 * or removing a field never breaks the display of past enquiries, the same
 * reasoning RentalConfiguration snapshots rental_unit onto each Rental
 * rather than resolving it live (see RENTAL_MODULE_PLAN_ADMIN.md, 1.2).
 */
const Enquiry = model.define("enquiry", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  customer_id: model.text().nullable(),
  customer_email: model.text(),
  message: model.text(),
  reply: model.text().nullable(),
  status: model.enum(["pending", "responded", "closed"]).default("pending"),
  responded_at: model.dateTime().nullable(),
  custom_field_answers: model.json<EnquiryFieldAnswers>().nullable(),
  custom_fields_snapshot: model.json<EnquiryFieldDefinition[]>().nullable(),
})

export default Enquiry
