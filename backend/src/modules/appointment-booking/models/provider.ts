import { model } from "@medusajs/framework/utils"
import { RecurringAvailability } from "./recurring-availability"
import { AvailabilityException } from "./availability-exception"
import { Appointment } from "./appointment"
import { ServiceProvider } from "./service-provider"

/**
 * A bookable resource: a stylist, a doctor, a room, a trainer. The table keeps
 * its original name ("provider") so the double-booking constraint and the
 * capacity trigger that reference provider_id stay untouched; the API and UI
 * call it a Resource.
 *
 * A business (vendor) owns many resources. Each resource carries its own
 * timezone, schedule and booking rules, which together decide the slots a
 * buyer sees.
 */
export const Provider = model.define("provider", {
  id: model.id().primaryKey(),
  // The owning business. Required for every resource created through the
  // resource API (enforced there); nullable in the database only so rows that
  // pre-date multi-resource support survive until the backfill script has run.
  vendor_id: model.text().nullable(),
  // Legacy 1:1 link to the staff login that created the profile. No longer
  // unique and no longer required: a vendor now has many resources, and an
  // admin can create one on a vendor's behalf.
  vendor_admin_id: model.text().nullable(),
  display_name: model.text().nullable(),
  bio: model.text().nullable(),
  description: model.text().nullable(),
  image_url: model.text().nullable(),
  // "staff" | "room" | "equipment" | ... - free text, display only.
  kind: model.text().default("staff"),
  // IANA tz, e.g. "America/New_York". Weekly hours (recurring_availability and
  // availability_exception times) are expressed in this zone.
  timezone: model.text(),
  status: model.enum(["active", "inactive"]).default("active"),

  // ---- booking rules (all minutes unless the name says otherwise) ----
  session_duration_minutes: model.number().default(30),
  // How often a slot may start. null = same as the session duration.
  slot_step_minutes: model.number().nullable(),
  // People per slot. 1 = private appointment, N = group session.
  capacity: model.number().default(1),
  buffer_before_minutes: model.number().default(0),
  buffer_after_minutes: model.number().default(0),
  min_notice_minutes: model.number().default(60),
  max_advance_days: model.number().default(60),
  // How long a reserved slot is held while the buyer pays.
  hold_minutes: model.number().default(10),
  // Buyers may cancel up to this many hours before the start.
  cancellation_window_hours: model.number().default(24),

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
.indexes([
  {
    on: ["vendor_id"],
  },
])
