const sent: any[] = []

jest.mock("../../src/lib/send-email", () => ({
  sendEmail: jest.fn(async (_container: unknown, input: any) => {
    sent.push(input)
    return "sent"
  }),
}))

// product -> owning vendor
jest.mock("../../src/lib/cart-shipping", () => ({
  loadProductSellers: jest.fn(async (_c: unknown, productIds: string[]) => {
    const owners: Record<string, { id: string; name: string }> = {
      prod_a1: { id: "ven_A", name: "Vendor A" },
      prod_a2: { id: "ven_A", name: "Vendor A" },
      prod_b1: { id: "ven_B", name: "Vendor B" },
    }
    return new Map(productIds.filter((id) => owners[id]).map((id) => [id, owners[id]]))
  }),
}))

jest.mock("../../src/modules/marketplace", () => ({ MARKETPLACE_MODULE: "marketplace" }))

import { sendVendorOrderEmails } from "../../src/lib/vendor-order-emails"

const line = (title: string, product_id: string, total: number) => ({ title, product_id, quantity: 1, total })

const ORDERS: Record<string, any> = {
  // The buyer's parent order holds EVERYONE's items.
  parent_1: {
    id: "parent_1",
    display_id: 10,
    currency_code: "usd",
    items: [line("A Widget", "prod_a1", 10), line("A Gadget", "prod_a2", 20), line("B Gizmo", "prod_b1", 99)],
  },
  child_A: { id: "child_A", display_id: 11, currency_code: "usd", items: [line("A Widget", "prod_a1", 10), line("A Gadget", "prod_a2", 20)] },
  child_B: { id: "child_B", display_id: 12, currency_code: "usd", items: [line("B Gizmo", "prod_b1", 99)] },
  // A child that (wrongly) also carries another vendor's line: the guard must drop it.
  child_C: { id: "child_C", display_id: 13, currency_code: "usd", items: [line("B Gizmo", "prod_b1", 99), line("A Widget", "prod_a1", 10)] },
}

const makeContainer = (splits: Array<{ child_order_id: string; vendor_id: string }>) => ({
  resolve: (key: string) => {
    if (key === "marketplace") {
      return { listVendorOrderSplits: async () => splits }
    }
    if (key === "query") {
      return {
        graph: async ({ entity, filters }: any) => {
          if (entity === "vendor") {
            const vendors: Record<string, any> = {
              ven_A: { id: "ven_A", name: "Vendor A", admins: [{ email: "a@vendor.test" }] },
              ven_B: { id: "ven_B", name: "Vendor B", admins: [{ email: "b@vendor.test" }] },
            }
            return { data: (filters.id as string[]).map((id) => vendors[id]).filter(Boolean) }
          }
          if (entity === "order") {
            const ids = Array.isArray(filters.id) ? filters.id : [filters.id]
            return { data: ids.map((id: string) => ORDERS[id]).filter(Boolean) }
          }
          return { data: [] }
        },
      }
    }
    return { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  },
})

const namesIn = (email: any) => (email.data.items as any[]).map((i) => i.name)

describe("vendor-new-order email isolation", () => {
  beforeEach(() => {
    sent.length = 0
  })

  it("mixed-vendor order: each vendor is emailed only their own items and totals", async () => {
    const container = makeContainer([
      { child_order_id: "child_A", vendor_id: "ven_A" },
      { child_order_id: "child_B", vendor_id: "ven_B" },
    ])

    await sendVendorOrderEmails(container as any, "parent_1", "split")

    expect(sent).toHaveLength(2)

    const toA = sent.find((e) => e.to === "a@vendor.test")
    const toB = sent.find((e) => e.to === "b@vendor.test")

    expect(namesIn(toA).sort()).toEqual(["A Gadget", "A Widget"])
    expect(namesIn(toB)).toEqual(["B Gizmo"])

    // Totals are the vendor's own: A = 10 + 20, B = 99 (never the parent's 129).
    const totalOf = (email: any) => email.data.rows.find((r: any) => r.label === "Your items total").value
    expect(totalOf(toA)).toBe("$30.00")
    expect(totalOf(toB)).toBe("$99.00")

    // Neither email mentions the other vendor's goods or the parent order number.
    expect(JSON.stringify(toA.data)).not.toContain("Gizmo")
    expect(JSON.stringify(toB.data)).not.toContain("Widget")
    expect(JSON.stringify(toA.data)).not.toContain("#10")
  })

  it("drops a line owned by another vendor even if it reached the child order", async () => {
    const container = makeContainer([{ child_order_id: "child_C", vendor_id: "ven_B" }])

    await sendVendorOrderEmails(container as any, "parent_1", "split")

    expect(sent).toHaveLength(1)
    expect(namesIn(sent[0])).toEqual(["B Gizmo"])
  })

  it("sends one email per vendor admin, each with a distinct idempotency key", async () => {
    const container = makeContainer([{ child_order_id: "child_A", vendor_id: "ven_A" }])
    await sendVendorOrderEmails(container as any, "parent_1", "split")
    expect(sent.map((e) => e.idempotencyKey)).toEqual(["vendor-new-order:child_A:a@vendor.test"])
  })

  it("sends nothing when the order was not split between sellers (mode none or child)", async () => {
    const container = makeContainer([])
    expect(await sendVendorOrderEmails(container as any, "parent_1", "none")).toBe(0)
    expect(await sendVendorOrderEmails(container as any, "parent_1", "child")).toBe(0)
    expect(sent).toHaveLength(0)
  })
})
