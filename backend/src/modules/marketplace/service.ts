import { MedusaService } from "@medusajs/framework/utils"
import { Vendor } from "./models/vendor"
import { VendorAdmin } from "./models/vendor-admin"
import { VendorProductImport } from "./models/vendor-product-import"
import { VendorOrderSplit } from "./models/vendor-order-split"
import { VendorUpload } from "./models/vendor-upload"

class MarketplaceModuleService extends MedusaService({
  Vendor,
  VendorAdmin,
  VendorProductImport,
  VendorOrderSplit,
  VendorUpload,
}) {}

export default MarketplaceModuleService
