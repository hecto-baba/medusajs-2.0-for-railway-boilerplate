"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import {
  SelectedSeat,
  TicketProductAvailability,
  TicketProductSeats,
} from "types/ticket"
import { getAuthHeaders, revalidateCacheTag } from "./cookies"
import { getOrSetCart } from "./cart"

/**
 * Show dates for a product with remaining seat counts.
 *
 * Never cached: a seat that was free a moment ago may have just been sold, and
 * showing a stale count invites a shopper to pick a seat they cannot have.
 */
export async function getTicketProductAvailability(
  productId: string
): Promise<TicketProductAvailability | null> {
  return sdk.client
    .fetch<TicketProductAvailability>(
      `/store/ticket-products/${productId}/availability`,
      {
        method: "GET",
        headers: { ...(await getAuthHeaders()) },
        cache: "no-store",
      }
    )
    .catch(() => {
      // A product that is not a show has no availability, which is not an
      // error - the product page simply renders its normal actions instead.
      return null
    })
}

/** The seat map for one show date. Also uncached, for the same reason. */
export async function getTicketProductSeats(
  productId: string,
  date: string
): Promise<TicketProductSeats> {
  return sdk.client
    .fetch<TicketProductSeats>(
      `/store/ticket-products/${productId}/seats`,
      {
        method: "GET",
        query: { date },
        headers: { ...(await getAuthHeaders()) },
        cache: "no-store",
      }
    )
    .catch(medusaError)
}

/**
 * Adds one line item per selected seat.
 *
 * Seats go through the ticket route rather than the standard line items route
 * because a ticket line has to be created with requires_shipping false. Left to
 * Medusa to derive, the flag falls back to the line item default of true and
 * cart completion then refuses the cart for having no shipping method. See the
 * backend's addTicketsToCartWorkflow.
 *
 * The whole selection is sent in one request, so either every seat joins the
 * cart or none does. Adding them one at a time named the seat that failed, but
 * left the earlier seats in the cart when a later one was already gone; the
 * backend reports the failing seat by name in its error either way.
 */
export async function addTicketsToCart({
  seats,
  countryCode,
}: {
  seats: SelectedSeat[]
  countryCode: string
}) {
  if (!seats.length) {
    throw new Error("Select at least one seat")
  }

  const cart = await getOrSetCart(countryCode)
  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  await sdk.client
    .fetch(`/store/carts/${cart.id}/line-items/tickets`, {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: {
        items: seats.map((seat) => ({
          variant_id: seat.variant_id,
          metadata: {
            seat_number: seat.seat_number,
            row_number: seat.row_number,
            venue_row_id: seat.venue_row_id,
            show_date: seat.show_date,
            row_type: seat.row_type,
          },
        })),
      },
    })
    .catch(medusaError)

  await revalidateCacheTag("carts")
}

/**
 * Completes a ticket cart through the ticket route.
 *
 * The standard complete endpoint would create the order but no ticket
 * purchases, leaving sold seats looking free to every later shopper and
 * giving the confirmation email no tickets to send.
 */
export async function completeTicketCart(cartId: string) {
  return sdk.client.fetch<{ type: string; order: HttpTypes.StoreOrder }>(
    `/store/carts/${cartId}/complete-tickets`,
    {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
    }
  )
}
