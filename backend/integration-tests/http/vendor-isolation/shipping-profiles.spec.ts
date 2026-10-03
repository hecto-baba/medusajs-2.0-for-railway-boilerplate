import { fulfillmentModule, registerPlatformResourceSuite } from "../helpers/platform-resource-suite"

/**
 * Phase 1, step 5 of docs/tenant-isolation-and-multi-tenancy.md: shipping
 * profiles had no owner (every seller saw, edited and deleted the same rows).
 */
registerPlatformResourceSuite({
  label: "shipping profiles",
  path: "/vendors/shipping-profiles",
  listKey: "shipping_profiles",
  itemKey: "shipping_profile",
  nameField: "name",
  create: (name) => ({ name, type: "default" }),
  createPlatform: (container, name) =>
    fulfillmentModule(container).createShippingProfiles({ name, type: "default" }),
  retrieve: (container, id) => fulfillmentModule(container).retrieveShippingProfile(id),
})
