import {
  canAdminAcceptQuote,
  canCustomerAcceptQuote,
  canDeclineQuote,
  isDecidedQuote,
} from "../../src/modules/quote/lib/transitions"
import { isCartApproved } from "../../src/utils/is-cart-approved"

describe("quote status rules", () => {
  it("the buyer can accept only a quote the seller has priced and sent", () => {
    expect(canCustomerAcceptQuote("pending_customer")).toBe(true)
    for (const status of ["pending_merchant", "accepted", "customer_rejected", "merchant_rejected"]) {
      expect(canCustomerAcceptQuote(status)).toBe(false)
    }
  })

  it("an open quote can be declined; a decided one cannot be reopened or declined", () => {
    expect(canDeclineQuote("pending_merchant")).toBe(true)
    expect(canDeclineQuote("pending_customer")).toBe(true)
    expect(canDeclineQuote("accepted")).toBe(false)
    expect(canDeclineQuote("customer_rejected")).toBe(false)
    expect(canDeclineQuote("merchant_rejected")).toBe(false)
  })

  it("admin can accept only an open quote", () => {
    expect(canAdminAcceptQuote("pending_merchant")).toBe(true)
    expect(canAdminAcceptQuote("accepted")).toBe(false)
    expect(isDecidedQuote("merchant_rejected")).toBe(true)
  })
})

describe("isCartApproved", () => {
  const at = (status: string, minute: number) => ({ status, created_at: new Date(2026, 0, 1, 0, minute) })

  it("is approved when the newest decision is approved", () => {
    expect(isCartApproved([{ statuses: [at("pending", 0), at("approved", 5)] }])).toBe(true)
  })

  it("is NOT approved when a manager approved and then rejected", () => {
    expect(isCartApproved([{ statuses: [at("pending", 0), at("approved", 5), at("rejected", 9)] }])).toBe(false)
  })

  it("is approved again when rejected and then approved", () => {
    expect(isCartApproved([{ statuses: [at("rejected", 3), at("approved", 8)] }])).toBe(true)
  })

  it("is not approved while only pending, or with no approvals at all", () => {
    expect(isCartApproved([{ statuses: [at("pending", 0)] }])).toBe(false)
    expect(isCartApproved([])).toBe(false)
    expect(isCartApproved(null)).toBe(false)
    expect(isCartApproved([{ statuses: null }])).toBe(false)
  })

  it("looks across several approvals on the same cart", () => {
    expect(
      isCartApproved([{ statuses: [at("approved", 1)] }, { statuses: [at("rejected", 6)] }])
    ).toBe(false)
  })
})
