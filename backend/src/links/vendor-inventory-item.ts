import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import InventoryModule from "@medusajs/medusa/inventory"

/**
 * isList on the inventory item side: a vendor owns many inventory items.
 * The link is created when an inventory item is created in the vendor panel,
 * and read when scoping a vendor admin's inventory items.
 *
 * deleteCascade drops the link rows with the vendor rather than stranding
 * them; the inventory items themselves are managed by the Inventory module.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: InventoryModule.linkable.inventoryItem.id,
    isList: true,
  }
)
