import { model } from "@medusajs/framework/utils"
import { Provider } from "./provider"

export const AvailabilityException = model.define("availability_exception", {
  id: model.id().primaryKey(),
  provider: model.belongsTo(() => Provider, {
    mappedBy: "availability_exceptions",
  }),
  date: model.dateTime(),
  type: model.enum(["blackout", "extra_hours"]),
  // Required when type = extra_hours; null on a blackout means the whole day.
  start_time: model.text().nullable(),
  end_time: model.text().nullable(),
  reason: model.text().nullable(),
})
.indexes([
  {
    on: ["provider_id", "date"],
  },
])
