import { Modules } from "@medusajs/framework/utils"
import { registerPlatformResourceSuite } from "../helpers/platform-resource-suite"

const productModule = (container: any) => container.resolve(Modules.PRODUCT) as any

/**
 * Phase 1, step 6 of docs/tenant-isolation-and-multi-tenancy.md: the type list
 * was global and types could be edited or deleted by any seller.
 */
registerPlatformResourceSuite({
  label: "product types",
  path: "/vendors/product-types",
  listKey: "product_types",
  itemKey: "product_type",
  nameField: "value",
  create: (name) => ({ value: name }),
  createPlatform: async (container, name) => (await productModule(container).createProductTypes([{ value: name }]))[0],
  retrieve: (container, id) => productModule(container).retrieveProductType(id),
})
