"use server"

import { unstable_cache } from "next/cache"
import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import {
  AppointmentBookingView,
  AppointmentBusiness,
  AppointmentBusinessDetail,
  AppointmentBuyer,
  AppointmentProductOffer,
  AppointmentSlots,
  RescheduleSlot,
} from "types/appointment"
import { getOrSetCart } from "./cart"
import { getAuthHeaders, revalidateCacheTag } from "./cookies"
import { getRegion } from "./regions"

/**
 * Appointment reads are never cached: a slot that was free a moment ago may have
 * just been booked, and showing it invites a shopper to pick a time they cannot
 * have. (Same reasoning as the ticket seat map.)
 */

export async function listBusinesses(params: {
  q?: string
  limit?: number
  offset?: number
}) {
  return sdk.client
    .fetch<{
      businesses: AppointmentBusiness[]
      count: number
      limit: number
      offset: number
    }>("/store/appointments/businesses", {
      method: "GET",
      query: {
        q: params.q || undefined,
        limit: params.limit ?? 12,
        offset: params.offset ?? 0,
      },
      cache: "no-store",
    })
    .catch(medusaError)
}

export async function getBusiness(
  handle: string,
  countryCode: string
): Promise<AppointmentBusinessDetail | null> {
  const region = await getRegion(countryCode)

  return sdk.client
    .fetch<AppointmentBusinessDetail>(
      `/store/appointments/businesses/${encodeURIComponent(handle)}`,
      {
        method: "GET",
        // The business route prices each service, and it fails without a
        // currency ("calculatePrices requires currency_code"), so send the
        // region's currency along with the region.
        query: {
          region_id: region?.id,
          currency_code: region?.currency_code,
        },
        cache: "no-store",
      }
    )
    .catch(() => null)
}

/**
 * Is this product an appointment, can it be booked right now, and with whom?
 * Null means an ordinary product (or the lookup failed), so the product page keeps
 * its normal flow rather than breaking.
 */
const cachedAppointmentOffer = unstable_cache(
  async (
    productId: string,
    regionId?: string
  ): Promise<AppointmentProductOffer | null> =>
    sdk.client
      .fetch<AppointmentProductOffer>(
        `/store/appointments/products/${encodeURIComponent(productId)}`,
        {
          method: "GET",
          query: { region_id: regionId },
        }
      )
      .then((offer) => (offer?.is_appointment ? offer : null))
      .catch(() => null),
  ["appointment-offer"],
  { revalidate: 60, tags: ["appointment-offer"] }
)

export async function getProductAppointmentOffer(
  productId: string,
  regionId?: string
): Promise<AppointmentProductOffer | null> {
  // The offer (who can be booked, starting price) is the same for every
  // visitor, and an ordinary product's "not an appointment" answer is cached
  // too. Actual slots (getAppointmentSlots) stay uncached.
  return cachedAppointmentOffer(productId, regionId)
}

export async function getAppointmentSlots(params: {
  resourceId: string
  productId: string
  variantId?: string
  from: string
  to: string
  countryCode: string
}): Promise<AppointmentSlots> {
  const region = await getRegion(params.countryCode)

  return sdk.client
    .fetch<AppointmentSlots>(
      `/store/appointments/resources/${params.resourceId}/slots`,
      {
        method: "GET",
        query: {
          product_id: params.productId,
          variant_id: params.variantId,
          from: params.from,
          to: params.to,
          region_id: region?.id,
          // Slots are priced, and pricing fails without a currency.
          currency_code: region?.currency_code,
        },
        cache: "no-store",
      }
    )
    .catch(medusaError)
}

/**
 * Reserves the chosen slot and puts it in the cart. The place is held for the
 * resource's hold time while the shopper pays. Only WHICH resource, WHICH variant
 * and WHEN are sent - the server decides the price.
 */
export async function addAppointmentToCart(params: {
  countryCode: string
  resourceId: string
  variantId: string
  start: string
  buyer: AppointmentBuyer
}) {
  const cart = await getOrSetCart(params.countryCode)
  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const result = await sdk.client
    .fetch<{ hold: { hold_expires_at: string; hold_minutes: number } }>(
      `/store/carts/${cart.id}/line-items/appointments`,
      {
        method: "POST",
        headers: { ...(await getAuthHeaders()) },
        body: {
          resource_id: params.resourceId,
          variant_id: params.variantId,
          start: params.start,
          buyer: params.buyer,
        },
      }
    )
    .catch(medusaError)

  await revalidateCacheTag("carts")

  return { hold: result.hold }
}

export async function listMyBookings(params: { limit?: number; offset?: number } = {}) {
  return sdk.client
    .fetch<{
      bookings: AppointmentBookingView[]
      count: number
      limit: number
      offset: number
    }>("/store/appointments/my-bookings", {
      method: "GET",
      query: { limit: params.limit ?? 20, offset: params.offset ?? 0 },
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .catch(() => null)
}

export async function getBooking(
  id: string,
  token?: string
): Promise<AppointmentBookingView | null> {
  return sdk.client
    .fetch<{ booking: AppointmentBookingView }>(
      `/store/appointments/bookings/${encodeURIComponent(id)}`,
      {
        method: "GET",
        query: { token },
        headers: { ...(await getAuthHeaders()) },
        cache: "no-store",
      }
    )
    .then((res) => res.booking)
    .catch(() => null)
}

export async function cancelBooking(params: {
  id: string
  token?: string
  reason?: string
}) {
  await sdk.client
    .fetch(`/store/appointments/bookings/${encodeURIComponent(params.id)}/cancel`, {
      method: "POST",
      query: { token: params.token },
      headers: { ...(await getAuthHeaders()) },
      body: { reason: params.reason || null },
    })
    .catch(medusaError)

  await revalidateCacheTag("orders")
}

/**
 * The times a booking could move to: same resource and service. Never cached, for
 * the same reason as every other slot read.
 */
export async function getRescheduleSlots(params: {
  id: string
  token?: string
  from: string
  to: string
}) {
  return sdk.client
    .fetch<{
      resource: { id: string; timezone: string }
      count: number
      slots: RescheduleSlot[]
    }>(`/store/appointments/bookings/${encodeURIComponent(params.id)}/slots`, {
      method: "GET",
      query: { token: params.token, from: params.from, to: params.to },
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .catch(medusaError)
}

export async function rescheduleBooking(params: {
  id: string
  token?: string
  start: string
}) {
  await sdk.client
    .fetch(`/store/appointments/bookings/${encodeURIComponent(params.id)}/reschedule`, {
      method: "POST",
      query: { token: params.token },
      headers: { ...(await getAuthHeaders()) },
      body: { start: params.start },
    })
    .catch(medusaError)

  await revalidateCacheTag("orders")
}
