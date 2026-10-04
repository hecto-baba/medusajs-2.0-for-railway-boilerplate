/**
 * Which quote status changes are allowed.
 *
 *   pending_merchant --(seller sends a price)--> pending_customer
 *   pending_customer --(buyer accepts)---------> accepted
 *   either pending   --(buyer or seller declines)--> customer_rejected / merchant_rejected
 *
 * accepted and both rejected states are final. Every route and workflow that
 * changes a quote checks these, so none of them can accept a quote the seller has
 * not priced yet, decline one that is already an order, or reopen a decided one.
 */
export const DECIDED_QUOTE_STATUSES = ["accepted", "customer_rejected", "merchant_rejected"] as const

export const isDecidedQuote = (status: string): boolean =>
  (DECIDED_QUOTE_STATUSES as readonly string[]).includes(status)

/** The buyer can only accept a quote the seller has priced and sent. */
export const canCustomerAcceptQuote = (status: string): boolean => status === "pending_customer"

/** An open quote can be declined by either side, at any point before it is decided. */
export const canDeclineQuote = (status: string): boolean => !isDecidedQuote(status)

/** A platform admin can accept on the buyer's behalf, but only an open quote. */
export const canAdminAcceptQuote = (status: string): boolean => !isDecidedQuote(status)

export const quoteStatusMessage = (status: string): string =>
  status === "accepted"
    ? "This quote has already been accepted."
    : status === "customer_rejected" || status === "merchant_rejected"
      ? "This quote has already been declined."
      : status === "pending_merchant"
        ? "The seller has not sent a price for this quote yet."
        : "This quote cannot be changed in its current state."
