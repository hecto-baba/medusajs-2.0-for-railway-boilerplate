export type AppointmentBusiness = {
  id: string
  handle: string
  name: string
  logo: string | null
  resource_count: number
}

export type AppointmentVariant = {
  id: string
  title: string | null
  price: number | null
}

export type AppointmentService = {
  product_id: string
  title: string
  description: string | null
  thumbnail: string | null
  duration_minutes: number
  capacity: number
  from_price: number | null
  currency_code: string | null
  variants: AppointmentVariant[]
}

export type AppointmentResource = {
  id: string
  name: string | null
  description: string | null
  image_url: string | null
  kind: string
  timezone: string
  services: AppointmentService[]
}

export type AppointmentBusinessDetail = {
  business: { id: string; handle: string; name: string; logo: string | null }
  resources: AppointmentResource[]
}

/**
 * What a product page needs to know about an appointment product: whether it can
 * be booked right now and with whom. "Not bookable" is a normal answer.
 */
export type AppointmentProductOffer = {
  bookable: boolean
  /** true = a service (even if it cannot be booked right now); false = ordinary product. */
  is_appointment: boolean
  business: { id: string; handle: string; name: string; logo: string | null } | null
  service: {
    product_id: string
    title: string
    description: string | null
    thumbnail: string | null
    from_price: number | null
    currency_code: string | null
    variants: AppointmentVariant[]
  } | null
  resources: {
    id: string
    name: string | null
    description: string | null
    image_url: string | null
    kind: string
    timezone: string
    duration_minutes: number
    capacity: number
  }[]
}

export type AppointmentSlot = {
  start: string
  end: string
  capacity: number
  spots_left: number
  price: number | null
}

export type AppointmentSlots = {
  resource: {
    id: string
    name: string | null
    timezone: string
    hold_minutes: number
    cancellation_window_hours: number
  }
  variant_id: string
  currency_code: string | null
  count: number
  slots: AppointmentSlot[]
}

export type AppointmentBuyer = {
  name: string
  email: string
  phone?: string | null
  notes?: string | null
}

export type AppointmentBookingView = {
  id: string
  status: "reserved" | "confirmed" | "cancelled"
  order_id: string | null
  start_time: string
  end_time: string
  resource: { id: string; name: string | null; timezone: string | null }
  service: { product_id: string; title: string | null }
  buyer_name: string | null
  cancel_deadline: string
  can_cancel: boolean
  cancelled_by: string | null
  can_reschedule: boolean
  reschedules_left: number
  /** The time the booking had before its latest move, if it was moved. */
  rescheduled_from_start: string | null
  rescheduled_by: "buyer" | "vendor" | "admin" | "system" | null
}

export type RescheduleSlot = {
  start: string
  end: string
  capacity: number
  spots_left: number
}

/**
 * An appointment line item is identified by the attendee it holds, the same way
 * a ticket is identified by its seat metadata and a rental by its dates.
 */
export const isAppointmentLineItem = (
  metadata?: Record<string, unknown> | null
): boolean => !!metadata?.attendee_id && !!metadata?.start_time

/**
 * True when every line in the cart is a ticket or an appointment. Such a cart has
 * nothing to ship - its lines are created with requires_shipping false - so it
 * never gets a shipping method, and every checkout step that would otherwise
 * insist on one (address, payment, review, place order) must skip that check.
 * Deliberately "every item", not "any item": a cart that mixes in a physical
 * product still has to be shipped.
 */
export const isNoShippingCart = (
  items: { metadata?: Record<string, unknown> | null }[] | null | undefined
): boolean =>
  !!items &&
  items.length > 0 &&
  items.every(
    (item) =>
      isAppointmentLineItem(item.metadata) ||
      (!!item.metadata?.seat_number && !!item.metadata?.show_date)
  )
