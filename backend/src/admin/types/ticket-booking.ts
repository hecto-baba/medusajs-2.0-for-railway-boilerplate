export enum RowType {
  VIP = "vip",
  PREMIUM = "premium",
  BALCONY = "balcony",
  STANDARD = "standard",
}

export const ROW_TYPES = [
  RowType.VIP,
  RowType.PREMIUM,
  RowType.BALCONY,
  RowType.STANDARD,
] as const

/**
 * Row types carry a colour so a seating tier reads the same everywhere it
 * appears: the seat chart, the pricing step and the shows table.
 */
export const ROW_TYPE_STYLES: Record<
  RowType,
  { label: string; badge: string; swatch: string }
> = {
  [RowType.VIP]: {
    label: "VIP",
    badge: "bg-ui-tag-purple-bg text-ui-tag-purple-text",
    swatch: "bg-ui-tag-purple-bg border-ui-tag-purple-border",
  },
  [RowType.PREMIUM]: {
    label: "Premium",
    badge: "bg-ui-tag-orange-bg text-ui-tag-orange-text",
    swatch: "bg-ui-tag-orange-bg border-ui-tag-orange-border",
  },
  [RowType.BALCONY]: {
    label: "Balcony",
    badge: "bg-ui-tag-blue-bg text-ui-tag-blue-text",
    swatch: "bg-ui-tag-blue-bg border-ui-tag-blue-border",
  },
  [RowType.STANDARD]: {
    label: "Standard",
    badge: "bg-ui-tag-neutral-bg text-ui-tag-neutral-text",
    swatch: "bg-ui-bg-component border-ui-border-base",
  },
}

export type VenueRow = {
  id: string
  row_number: string
  row_type: RowType
  seat_count: number
  venue_id: string
}

export type Venue = {
  id: string
  name: string
  address?: string | null
  rows: VenueRow[]
  created_at: string
  updated_at: string
}

export type TicketProduct = {
  id: string
  product_id: string
  venue_id: string
  dates: string[]
  venue?: Pick<Venue, "id" | "name" | "address"> & { rows?: VenueRow[] }
  product?: {
    id: string
    title: string
    handle?: string
    status?: string
  }
  variants?: {
    id: string
    row_type: RowType
    product_variant_id: string
  }[]
  created_at: string
  updated_at: string
}

export type VenueListResponse = {
  venues: Venue[]
  count: number
  limit: number
  offset: number
}

export type TicketProductListResponse = {
  ticket_products: TicketProduct[]
  count: number
  limit: number
  offset: number
}

export const totalSeats = (rows: VenueRow[] = []) =>
  rows.reduce((total, row) => total + (row.seat_count || 0), 0)

/** Seating tiers a venue actually has rows for. */
export const venueRowTypes = (rows: VenueRow[] = []) =>
  ROW_TYPES.filter((rowType) => rows.some((row) => row.row_type === rowType))
