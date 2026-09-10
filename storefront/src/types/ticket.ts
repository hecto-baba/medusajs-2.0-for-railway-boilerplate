export type RowType = "vip" | "premium" | "balcony" | "standard"

export type TicketVenueRow = {
  id: string
  row_number: string
  row_type: RowType
  seat_count: number
}

export type TicketVenue = {
  id: string
  name: string
  address?: string | null
  rows?: TicketVenueRow[]
}

export type ShowDateAvailability = {
  date: string
  total_seats: number
  seats_sold: number
  seats_available: number
  is_sold_out: boolean
}

export type TicketProductAvailability = {
  ticket_product: {
    id: string
    product_id: string
    venue: TicketVenue
  }
  availability: ShowDateAvailability[]
}

export type Seat = {
  seat_number: string
  is_available: boolean
}

export type SeatMapRow = {
  venue_row_id: string
  row_number: string
  row_type: RowType
  seat_count: number
  /** Null when no variant exists for this date and tier. */
  variant_id: string | null
  seats: Seat[]
}

export type TicketProductSeats = {
  date: string
  venue: TicketVenue
  seat_map: SeatMapRow[]
}

/** A seat the shopper has picked but not yet added to the cart. */
export type SelectedSeat = {
  seat_number: string
  row_number: string
  venue_row_id: string
  variant_id: string
  row_type: RowType
  show_date: string
}

export const ROW_TYPE_LABELS: Record<RowType, string> = {
  vip: "VIP",
  premium: "Premium",
  balcony: "Balcony",
  standard: "Standard",
}

/**
 * A ticket line item is identified by its seat metadata, the same way a rental
 * is identified by its date metadata.
 */
export const isTicketLineItem = (
  metadata?: Record<string, unknown> | null
): boolean => !!metadata?.seat_number && !!metadata?.show_date
