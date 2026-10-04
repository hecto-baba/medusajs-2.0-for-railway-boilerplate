export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export type ResourceSettings = {
  session_duration_minutes: number
  slot_step_minutes: number | null
  capacity: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  min_notice_minutes: number
  max_advance_days: number
  hold_minutes: number
  cancellation_window_hours: number
}

export type Readiness = {
  has_hours: boolean
  has_services: boolean
  live: boolean
  missing: string[]
}

/** A bookable resource (the table keeps its original name, "provider"). */
export type Provider = ResourceSettings & {
  id: string
  vendor_id: string | null
  vendor_admin_id: string | null
  display_name: string | null
  description: string | null
  bio: string | null
  image_url: string | null
  kind: string
  timezone: string
  status: "active" | "inactive"
  vendor?: { id: string; name: string; handle: string } | null
  vendor_admin?: {
    email: string
    first_name?: string | null
    last_name?: string | null
  } | null
  readiness?: Readiness
}

export type RecurringAvailability = {
  id: string
  provider_id: string
  day_of_week: number
  start_time: string
  end_time: string
  effective_from: string
  effective_until: string | null
  status: "active" | "inactive"
}

export type AvailabilityException = {
  id: string
  provider_id: string
  date: string
  type: "blackout" | "extra_hours"
  start_time: string | null
  end_time: string | null
  reason: string | null
}

export type BookingAttendee = {
  id: string
  status: "reserved" | "confirmed" | "cancelled"
  buyer_name: string | null
  buyer_email: string | null
  buyer_phone: string | null
  notes: string | null
  order_id: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  rescheduled_from_start: string | null
  rescheduled_by: string | null
  reschedule_count: number
}

export type RescheduleSlot = {
  start: string
  end: string
  capacity: number
  capacity_remaining: number
}

export type Booking = {
  id: string
  start_time: string
  end_time: string
  status: string
  max_capacity: number
  resource: { id: string; display_name: string | null; timezone: string | null }
  service: { product_id: string; title: string | null }
  attendees: BookingAttendee[]
}

export type OfferedService = {
  id: string
  product_id: string
  duration_minutes: number | null
  capacity: number | null
  product: { id: string; title: string; variants?: { id: string; title: string | null }[] } | null
}

export type PreviewSlot = {
  start: string
  end: string
  capacity: number
  capacity_remaining: number
  spots_taken: number
}

// Kept for the product widget, which reads the legacy offering rows.
export type ServiceProvider = {
  id: string
  provider_id: string
  service_product_id: string
  default_duration_minutes: number
  duration_minutes?: number | null
  capacity?: number | null
}

export type ProviderResponse = { provider: Provider | null }
export type RecurringAvailabilityListResponse = {
  recurring_availabilities: RecurringAvailability[]
}
export type AvailabilityExceptionListResponse = {
  availability_exceptions: AvailabilityException[]
}
export type BookingListResponse = {
  appointments: Booking[]
  count: number
  limit: number
  offset: number
}
