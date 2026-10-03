export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export type Provider = {
  id: string
  vendor_admin_id: string
  display_name: string | null
  bio: string | null
  timezone: string
  status: "active" | "inactive"
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

export type AppointmentAttendee = {
  id: string
  appointment_id: string
  customer_id: string
  order_id: string | null
  line_item_id: string | null
  status: "reserved" | "confirmed" | "cancelled"
}

export type Appointment = {
  id: string
  provider_id: string
  service_product_id: string
  service_variant_id: string | null
  start_time: string
  end_time: string
  max_capacity: number
  status: "available" | "booked" | "cancelled" | "completed"
  order_id: string | null
  service_product?: { id: string; title: string } | null
  attendees?: AppointmentAttendee[]
}

export type ServiceProvider = {
  id: string
  provider_id: string
  service_product_id: string
  default_duration_minutes: number
}

export type ProviderResponse = { provider: Provider | null }
export type RecurringAvailabilityListResponse = {
  recurring_availabilities: RecurringAvailability[]
}
export type AvailabilityExceptionListResponse = {
  availability_exceptions: AvailabilityException[]
}
export type AppointmentListResponse = { appointments: Appointment[] }
