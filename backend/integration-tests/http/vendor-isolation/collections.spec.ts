import { Modules } from "@medusajs/framework/utils"
import { registerPlatformResourceSuite } from "../helpers/platform-resource-suite"

const productModule = (container: any) => container.resolve(Modules.PRODUCT) as any

/**
 * Phase 1, step 9 of docs/tenant-isolation-and-multi-tenancy.md: any seller
 * could rename or delete any collection, and the list included collections
 * that merely contained the seller's products.
 */
registerPlatformResourceSuite({
  label: "collections",
  path: "/vendors/collections",
  listKey: "collections",
  itemKey: "collection",
  nameField: "title",
  create: (name) => ({ title: name }),
  createPlatform: async (container, name) => (await productModule(container).createProductCollections([{ title: name }]))[0],
  retrieve: (container, id) => productModule(container).retrieveProductCollection(id),
})
