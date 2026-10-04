// Expected outcomes of an add-to-cart are returned by the server action instead
// of thrown. A thrown error's message is replaced with a generic one in
// production builds, which hid the reason from the shopper.

// A cart-rule violation (food mixed with retail, two restaurants in one cart).
// The shopper can resolve it by clearing the cart.
export type CartConflict = {
  conflict:
    | "CONFLICT_RETAIL_EXISTS"
    | "CONFLICT_RESTAURANT_EXISTS"
    | "CONFLICT_FOOD_EXISTS"
  message: string
}

// Anything else that went wrong. The real error is logged on the server; this
// message is safe to show because it carries no ids or backend detail.
export type CartFailure = {
  error: string
}

export type CartResult = CartConflict | CartFailure | void

export const isCartConflict = (value: unknown): value is CartConflict =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as CartConflict).conflict === "string" &&
  typeof (value as CartConflict).message === "string"

export const isCartFailure = (value: unknown): value is CartFailure =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as CartFailure).error === "string"
