import { MedusaService } from "@medusajs/framework/utils"
import Enquiry from "./models/enquiry"
import EnquiryConfiguration from "./models/enquiry-configuration"

/**
 * Thin on purpose: status transitions and ownership scoping are query/
 * workflow-shaped, not service-shaped, so the auto-generated CRUD (createEnquiries,
 * listEnquiries, updateEnquiries, createEnquiryConfigurations, ...) is
 * sufficient for now. Mirrors how RentalModuleService only adds methods for
 * genuinely query-shaped logic (overlap checks) rather than wrapping every
 * transition.
 */
class ProductEnquiryModuleService extends MedusaService({
  Enquiry,
  EnquiryConfiguration,
}) {}

export default ProductEnquiryModuleService
