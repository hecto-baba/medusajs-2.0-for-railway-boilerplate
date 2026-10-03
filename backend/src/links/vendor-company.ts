import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import CompanyModule from "../modules/company"

/**
 * Links a Vendor to B2B Companies.
 * isList on the company side: a vendor can maintain multiple corporate B2B client accounts.
 * deleteCascade ensures orphaned link rows are removed when a vendor is deleted.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: CompanyModule.linkable.company.id,
    isList: true,
  }
)
