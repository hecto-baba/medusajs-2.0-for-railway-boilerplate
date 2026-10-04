import { HttpTypes } from "@medusajs/types"

/**
 * How a product is sold, which decides what a product card offers.
 *
 *  plain    one purchasable option: one-tap ADD
 *  select   several options (size, colour, a show's seat types): pick on the page
 *  rent     rented by date
 *  digital  downloadable
 *  enquiry  asks the seller a question instead of ordering
 *  book     booked by person and time
 *  dish     a restaurant dish, ordered from the restaurant's menu
 */
export type ProductKind =
  | "plain"
  | "select"
  | "rent"
  | "digital"
  | "enquiry"
  | "book"
  | "dish"

type ClassifiableProduct = HttpTypes.StoreProduct & {
  rental_configuration?: { status?: string } | null
  enquiry_configuration?: { status?: string } | null
}

export const getProductKind = (
  product: HttpTypes.StoreProduct,
  appointmentProductIds?: ReadonlySet<string>
): ProductKind => {
  const p = product as ClassifiableProduct
  const metadata = (p.metadata ?? {}) as Record<string, unknown>

  // Restaurant dishes carry dietary metadata and are ordered per restaurant.
  if (metadata.dietary_type !== undefined || metadata.is_veg !== undefined) {
    return "dish"
  }
  if (p.enquiry_configuration?.status === "active") {
    return "enquiry"
  }
  if (appointmentProductIds?.has(p.id)) {
    return "book"
  }
  if (p.rental_configuration?.status === "active") {
    return "rent"
  }
  if (p.variants?.some((v) => !!(v as { digital_product?: unknown }).digital_product)) {
    return "digital"
  }
  if ((p.variants?.length ?? 0) > 1) {
    return "select"
  }
  return "plain"
}

export const KIND_ACTION_LABEL: Record<Exclude<ProductKind, "plain">, string> = {
  select: "SELECT",
  rent: "RENT",
  digital: "VIEW",
  enquiry: "ASK",
  book: "BOOK",
  dish: "VIEW",
}

export const KIND_TAG: Partial<Record<ProductKind, string>> = {
  rent: "Rent",
  digital: "Digital",
  enquiry: "Enquiry",
  book: "Book",
  dish: "Menu",
}
