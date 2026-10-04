import { model } from "@medusajs/framework/utils"
import { Provider } from "./provider"

/**
 * Which resources offer a given product as a bookable service (an "offering").
 * The product is a normal Medusa product owned by the same vendor; its variant
 * price is the base price. The optional overrides let one resource run a
 * service with a different session length or capacity than its own defaults.
 *
 * Appointment rows themselves still belong to exactly one resource each.
 */
export const ServiceProvider = model.define("service_provider", {
  id: model.id().primaryKey(),
  provider: model.belongsTo(() => Provider, {
    mappedBy: "service_providers",
  }),
  service_product_id: model.text(),
  // Legacy: set by the admin product widget. Kept readable until that widget is
  // retired; new code reads duration_minutes and falls back to the resource.
  default_duration_minutes: model.number(),
  duration_minutes: model.number().nullable(),
  capacity: model.number().nullable(),
})
.indexes([
  {
    on: ["provider_id", "service_product_id"],
    unique: true,
  },
  {
    on: ["service_product_id"],
  },
])
