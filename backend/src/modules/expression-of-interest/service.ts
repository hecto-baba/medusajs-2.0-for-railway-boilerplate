import { MedusaService } from "@medusajs/framework/utils"
import { Eoi } from "./models/eoi"
import { EoiConfiguration } from "./models/eoi-configuration"

/**
 * Thin on purpose, same rationale as ProductEnquiryModuleService: auto-CRUD
 * (createEois, listEois, updateEois, createEoiConfigurations, ...) covers
 * everything except genuinely query-shaped lookups, added here as needed
 * (e.g. hasOpenEoi, once a "one open EOI per customer per product" rule exists).
 */
class ExpressionOfInterestModuleService extends MedusaService({
  Eoi,
  EoiConfiguration,
}) {}

export default ExpressionOfInterestModuleService
