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
 * Seats are added one at a time rather than batched because the backend's
 * add-to-cart validation reports the first seat that fails by name; a batch
 * would fail as a whole and leave the shopper guessing which seat was gone.
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

  for (const seat of seats) {
    await sdk.store.cart
      .createLineItem(
        cart.id,
        {
          variant_id: seat.variant_id,
          // One seat is one ticket; the backend rejects any other quantity.
          quantity: 1,
          metadata: {
            seat_number: seat.seat_number,
            row_number: seat.row_number,
            venue_row_id: seat.venue_row_id,
            show_date: seat.show_date,
            row_type: seat.row_type,
          },
        },
        {},
        await getAuthHeaders()
      )
      .catch(medusaError)
  }

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
