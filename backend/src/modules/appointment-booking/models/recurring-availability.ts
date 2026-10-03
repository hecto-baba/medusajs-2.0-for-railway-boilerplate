import { model } from "@medusajs/framework/utils"
import { Provider } from "./provider"

export const RecurringAvailability = model.define("recurring_availability", {
  id: model.id().primaryKey(),
  provider: model.belongsTo(() => Provider, {
    mappedBy: "recurring_availabilities",
  }),
  // 0-6, Sunday-Saturday. Validated in the create workflow's step, not here.
  day_of_week: model.number(),
  // "HH:mm" local to provider.timezone - text keeps it DST/timezone-safe
  // instead of trying to encode a recurring rule as an absolute datetime.
  start_time: model.text(),
  end_time: model.text(),
  effective_from: model.dateTime(),
  effective_until: model.dateTime().nullable(),
  status: model.enum(["active", "inactive"]).default("active"),
})
.indexes([
  {
    on: ["provider_id", "day_of_week"],
  },
])
