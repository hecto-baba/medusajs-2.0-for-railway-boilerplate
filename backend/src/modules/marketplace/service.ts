import { MedusaService } from "@medusajs/framework/utils"
import { Vendor } from "./models/vendor"
import { VendorAdmin } from "./models/vendor-admin"
import { VendorProductImport } from "./models/vendor-product-import"

class MarketplaceModuleService extends MedusaService({
  Vendor,
  VendorAdmin,
  VendorProductImport,
}) {}

export default MarketplaceModuleService
