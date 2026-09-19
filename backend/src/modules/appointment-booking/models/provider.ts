import { model } from "@medusajs/framework/utils"
import { RecurringAvailability } from "./recurring-availability"
import { AvailabilityException } from "./availability-exception"
import { Appointment } from "./appointment"
import { ServiceProvider } from "./service-provider"

export const Provider = model.define("provider", {
  id: model.id().primaryKey(),
  // 1:1 with marketplace VendorAdmin, linked via module link rather than a
  // direct relation so the two modules stay decoupled.
  vendor_admin_id: model.text().unique(),
  display_name: model.text().nullable(),
  bio: model.text().nullable(),
  // IANA tz, e.g. "America/New_York" - recurring_availability start/end
  // times are local to this.
  timezone: model.text(),
  status: model.enum(["active", "inactive"]).default("active"),
  recurring_availabilities: model.hasMany(() => RecurringAvailability, {
    mappedBy: "provider",
  }),
  availability_exceptions: model.hasMany(() => AvailabilityException, {
    mappedBy: "provider",
  }),
  appointments: model.hasMany(() => Appointment, {
    mappedBy: "provider",
  }),
  service_providers: model.hasMany(() => ServiceProvider, {
    mappedBy: "provider",
  }),
})
