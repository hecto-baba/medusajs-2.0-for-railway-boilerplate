import { model } from "@medusajs/framework/utils"
import { Provider } from "./provider"

/**
 * Which providers offer a given product as a bookable service, and the
 * default slot duration to use when generating appointments for it. Backs
 * the product admin widget's provider multi-select - Appointment rows
 * themselves still belong to exactly one provider each.
 */
export const ServiceProvider = model.define("service_provider", {
  id: model.id().primaryKey(),
  provider: model.belongsTo(() => Provider, {
    mappedBy: "service_providers",
  }),
  service_product_id: model.text(),
  default_duration_minutes: model.number(),
})
.indexes([
  {
    on: ["provider_id", "service_product_id"],
    unique: true,
  },
])
