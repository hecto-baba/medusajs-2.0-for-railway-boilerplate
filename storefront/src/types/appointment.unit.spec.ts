import { expect, test } from "@playwright/test"

import { isNoShippingCart } from "./appointment"

test.describe("isNoShippingCart", () => {
  test("an empty or missing cart is not a no-shipping cart", () => {
    expect(isNoShippingCart([])).toBe(false)
    expect(isNoShippingCart(null)).toBe(false)
    expect(isNoShippingCart(undefined)).toBe(false)
  })

  test("lines Medusa marks as not needing shipping skip delivery", () => {
    // Digital downloads, expressions of interest and pickup rentals.
    expect(isNoShippingCart([{ requires_shipping: false }])).toBe(true)
  })

  test("a physical line needs shipping", () => {
    expect(isNoShippingCart([{ requires_shipping: true }])).toBe(false)
  })

  test("one physical line is enough to need shipping", () => {
    expect(
      isNoShippingCart([
        { requires_shipping: true },
        { requires_shipping: false },
      ])
    ).toBe(false)
  })

  test("a pickup rental and its deposit need no shipping", () => {
    expect(
      isNoShippingCart([
        { requires_shipping: false },
        { requires_shipping: false },
      ])
    ).toBe(true)
  })

  test("a delivered rental and its deposit need shipping", () => {
    expect(
      isNoShippingCart([
        { requires_shipping: true },
        { requires_shipping: true },
      ])
    ).toBe(false)
  })

  test("tickets added before the flag existed are still recognised", () => {
    expect(
      isNoShippingCart([
        {
          requires_shipping: true,
          metadata: { seat_number: "A1", show_date: "2026-10-05" },
        },
      ])
    ).toBe(true)
  })

  test("appointments added before the flag existed are still recognised", () => {
    expect(
      isNoShippingCart([
        { metadata: { attendee_id: "att_1", start_time: "2026-10-05T09:00" } },
      ])
    ).toBe(true)
  })

  test("a ticket mixed with a physical product still needs shipping", () => {
    expect(
      isNoShippingCart([
        { metadata: { seat_number: "A1", show_date: "2026-10-05" } },
        { requires_shipping: true },
      ])
    ).toBe(false)
  })
})
