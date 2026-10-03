import { z } from "@medusajs/framework/zod"
import { isValidTimeZone } from "../../../modules/appointment-booking/lib/timezone"

const timezone = z
  .string()
  .refine(isValidTimeZone, { message: "Must be a valid IANA timezone, e.g. Asia/Kolkata" })

const minutes = (min: number, max: number) => z.number().int().min(min).max(max)

/** Booking-rule fields, each with the same bounds the database CHECK enforces. */
export const ResourceSettingsShape = {
  session_duration_minutes: minutes(1, 1440),
  slot_step_minutes: minutes(1, 1440).nullable(),
  capacity: minutes(1, 10000),
  buffer_before_minutes: minutes(0, 1440),
  buffer_after_minutes: minutes(0, 1440),
  min_notice_minutes: minutes(0, 525600),
  max_advance_days: minutes(1, 730),
  hold_minutes: minutes(1, 120),
  cancellation_window_hours: minutes(0, 8760),
}

const profileShape = {
  display_name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable(),
  bio: z.string().trim().max(2000).nullable(),
  image_url: z.string().url().max(2048).nullable(),
  kind: z.string().trim().min(1).max(40),
  timezone,
}

export const PostResourceSchema = z.object({
  display_name: profileShape.display_name,
  timezone: profileShape.timezone,
  description: profileShape.description.optional(),
  bio: profileShape.bio.optional(),
  image_url: profileShape.image_url.optional(),
  kind: profileShape.kind.optional(),
  session_duration_minutes: ResourceSettingsShape.session_duration_minutes.optional(),
  slot_step_minutes: ResourceSettingsShape.slot_step_minutes.optional(),
  capacity: ResourceSettingsShape.capacity.optional(),
  buffer_before_minutes: ResourceSettingsShape.buffer_before_minutes.optional(),
  buffer_after_minutes: ResourceSettingsShape.buffer_after_minutes.optional(),
  min_notice_minutes: ResourceSettingsShape.min_notice_minutes.optional(),
  max_advance_days: ResourceSettingsShape.max_advance_days.optional(),
  hold_minutes: ResourceSettingsShape.hold_minutes.optional(),
  cancellation_window_hours: ResourceSettingsShape.cancellation_window_hours.optional(),
})

export const UpdateResourceSchema = PostResourceSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
})

export const CopySettingsToSchema = z.object({
  to_resource_ids: z.array(z.string()).min(1).max(100),
})

export const SETTING_KEYS = Object.keys(ResourceSettingsShape) as Array<
  keyof typeof ResourceSettingsShape
>

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm")

export const PostHoursSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: hhmm,
  end_time: hhmm,
  effective_from: z.coerce.date(),
  effective_until: z.coerce.date().nullable().optional(),
})

export const UpdateHoursSchema = z.object({
  start_time: hhmm.optional(),
  end_time: hhmm.optional(),
  effective_from: z.coerce.date().optional(),
  effective_until: z.coerce.date().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export const PostExceptionSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["blackout", "extra_hours"]),
  start_time: hhmm.nullable().optional(),
  end_time: hhmm.nullable().optional(),
  reason: z.string().trim().max(300).nullable().optional(),
})

export const PostServicesSchema = z.object({
  services: z
    .array(
      z.object({
        product_id: z.string(),
        duration_minutes: minutes(1, 1440).nullable().optional(),
        capacity: minutes(1, 10000).nullable().optional(),
      })
    )
    .max(200),
})

export const GetSlotsPreviewSchema = z.object({
  product_id: z.string().optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
})

export const PostPricingRuleSchema = z.object({
  resource_id: z.string().nullable().optional(),
  product_id: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["percent_adjust", "fixed_adjust", "override_price"]),
  value: z.number().finite(),
  currency_code: z.string().trim().length(3).nullable().optional(),
  days_of_week: z.array(z.number().int().min(0).max(6)).max(7).nullable().optional(),
  start_time: hhmm.nullable().optional(),
  end_time: hhmm.nullable().optional(),
  valid_from: z.coerce.date().nullable().optional(),
  valid_until: z.coerce.date().nullable().optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
  is_active: z.boolean().optional(),
})

export const UpdatePricingRuleSchema = PostPricingRuleSchema.partial()

export const GetPricingPreviewSchema = z.object({
  resource_id: z.string(),
  product_id: z.string(),
  start: z.coerce.date(),
  currency_code: z.string().trim().length(3),
  base_price: z.coerce.number().min(0),
})

export const GetVendorAppointmentsSchema = z.object({
  resource_id: z.string().optional(),
  status: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const CancelAppointmentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

/**
 * A booking the seller enters themselves (a phone call or a walk-in). The
 * customer is not paying through checkout, so only a name is required; contact
 * details are optional.
 */
export const CreateManualAppointmentSchema = z.object({
  resource_id: z.string().min(1),
  product_id: z.string().min(1),
  start: z.coerce.date(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(1000).optional(),
})
