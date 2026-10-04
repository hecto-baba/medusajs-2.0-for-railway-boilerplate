import {
  assertVendorMaySetQuoteStatus,
  quoteBelongsToVendor,
  stripPlatformQuoteKeys,
} from "../../src/api/vendors/shared/ownership-scope"

describe("quoteBelongsToVendor", () => {
  const quote = (items: string[], metadata: any = null) => ({
    metadata,
    cart: { items: items.map((product_id) => ({ product_id })) },
  })

  it("is the seller's when an item is one of their products", () => {
    expect(quoteBelongsToVendor(quote(["p_mine", "p_other"]), "ven_A", ["p_mine"])).toBe(true)
  })

  it("is the seller's when the quote names them", () => {
    expect(quoteBelongsToVendor(quote([], { vendor_id: "ven_A" }), "ven_A", [])).toBe(true)
  })

  it("is NOT another seller's quote", () => {
    expect(quoteBelongsToVendor(quote(["p_theirs"], { vendor_id: "ven_B" }), "ven_A", ["p_mine"])).toBe(false)
  })

  it("is not anyone's when it has no items and names no seller (the old code said yes to everyone)", () => {
    expect(quoteBelongsToVendor(quote([]), "ven_A", ["p_mine"])).toBe(false)
    expect(quoteBelongsToVendor({ metadata: null, cart: null }, "ven_A", ["p_mine"])).toBe(false)
  })

  it("a seller who owns nothing owns no quotes", () => {
    expect(quoteBelongsToVendor(quote(["p_x"]), "ven_A", [])).toBe(false)
  })
})

describe("assertVendorMaySetQuoteStatus", () => {
  it("lets a seller send a price or decline an open quote", () => {
    expect(() => assertVendorMaySetQuoteStatus("pending_merchant", "pending_customer")).not.toThrow()
    expect(() => assertVendorMaySetQuoteStatus("pending_customer", "pending_customer")).not.toThrow()
    expect(() => assertVendorMaySetQuoteStatus("pending_merchant", "merchant_rejected")).not.toThrow()
  })

  it("never lets a seller accept a quote for the buyer", () => {
    expect(() => assertVendorMaySetQuoteStatus("pending_customer", "accepted")).toThrow(/can only set/)
    expect(() => assertVendorMaySetQuoteStatus("pending_customer", "customer_rejected")).toThrow(/can only set/)
  })

  it("rejects missing or non-string statuses", () => {
    expect(() => assertVendorMaySetQuoteStatus("pending_merchant", undefined)).toThrow()
    expect(() => assertVendorMaySetQuoteStatus("pending_merchant", { $ne: 1 })).toThrow()
  })

  it("does not let a decided quote be changed", () => {
    for (const decided of ["accepted", "customer_rejected", "merchant_rejected"]) {
      expect(() => assertVendorMaySetQuoteStatus(decided, "pending_customer")).toThrow(/already been decided/)
    }
  })
})

describe("stripPlatformQuoteKeys", () => {
  it("removes payment, fulfilment, ownership and message keys, keeps the rest", () => {
    expect(
      stripPlatformQuoteKeys({
        payment_status: "paid",
        fulfillment_status: "delivered",
        vendor_id: "ven_B",
        messages: [],
        note: "ok",
      })
    ).toEqual({ note: "ok" })
  })

  it("copes with junk", () => {
    expect(stripPlatformQuoteKeys(null)).toEqual({})
    expect(stripPlatformQuoteKeys("x")).toEqual({})
    expect(stripPlatformQuoteKeys([1])).toEqual({})
  })
})
