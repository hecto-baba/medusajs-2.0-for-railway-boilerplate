import { fulfillmentModule, registerPlatformResourceSuite } from "../helpers/platform-resource-suite"

const codeFor = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-")

/**
 * Phase 1, step 5 of docs/tenant-isolation-and-multi-tenancy.md: shipping
 * option types had no owner (every seller saw, edited and deleted the same rows).
 */
registerPlatformResourceSuite({
  label: "shipping option types",
  path: "/vendors/shipping-option-types",
  listKey: "shipping_option_types",
  itemKey: "shipping_option_type",
  nameField: "label",
  create: (name) => ({ label: name, code: codeFor(name) }),
  createPlatform: (container, name) =>
    fulfillmentModule(container).createShippingOptionTypes({ label: name, code: codeFor(name) }),
  retrieve: (container, id) => fulfillmentModule(container).retrieveShippingOptionType(id),
})
