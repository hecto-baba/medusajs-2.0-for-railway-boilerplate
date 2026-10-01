import { Modules } from "@medusajs/framework/utils"
import { registerPlatformResourceSuite } from "../helpers/platform-resource-suite"

const productModule = (container: any) => container.resolve(Modules.PRODUCT) as any

/**
 * Phase 1, step 6 of docs/tenant-isolation-and-multi-tenancy.md: the tag list
 * was global and tags could be edited or deleted by any seller.
 */
registerPlatformResourceSuite({
  label: "product tags",
  path: "/vendors/product-tags",
  listKey: "product_tags",
  itemKey: "product_tag",
  nameField: "value",
  create: (name) => ({ value: name }),
  createPlatform: async (container, name) => (await productModule(container).createProductTags([{ value: name }]))[0],
  retrieve: (container, id) => productModule(container).retrieveProductTag(id),
})
