import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 7 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A draft order belongs to the seller that created it. Another seller's draft
 * answers 404 on read, delete and convert. The create body may only name
 * customers, variants, channels and promotions the seller can use, which also
 * closes the chain where naming a stranger's customer made that customer "yours".
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: draft orders", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let draftA: string
      let draftB: string
      let variantA: string
      let variantB: string
      let customerStranger: string
      let customerA: string
      let channelB: string
      let regionId: string

      const draftOrderBody = (extra: Record<string, unknown> = {}) => ({
        email: "buyer@example.com",
        currency_code: "usd",
        region_id: regionId,
        items: [{ title: "Custom item", quantity: 1, unit_price: 1000 }],
        ...extra,
      })

      const productBody = (title: string) => ({
        title,
        options: [{ title: "Size", values: ["M"] }],
        variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 10 }], manage_inventory: false }],
      })

      const orderCount = async () => {
        const query: any = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({ entity: "order", fields: ["id"] })
        return data.length as number
      }

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        const container = getContainer()
        const regionModule = container.resolve(Modules.REGION) as any
        regionId = (await regionModule.createRegions({ name: "Test region", currency_code: "usd", countries: ["us"] })).id

        const productA = (await must("product A", api.post("/vendors/products", productBody("A product"), sellerA.headers))).data.product
        const productB = (await must("product B", api.post("/vendors/products", productBody("B product"), sellerB.headers))).data.product
        variantA = productA.variants[0].id
        variantB = productB.variants[0].id

        channelB = (await must("channel B", api.post("/vendors/sales-channels", { name: "B channel" }, sellerB.headers))).data.sales_channel.id

        // A customer that no seller has any relation to.
        const customerModule = container.resolve(Modules.CUSTOMER) as any
        customerStranger = (await customerModule.createCustomers({ email: "stranger@example.com" })).id
        customerA = (await must("customer A", api.post("/vendors/customers", { email: "mine@example.com", first_name: "Mine" }, sellerA.headers))).data
          .customer.id

        draftA = (await must("draft A", api.post("/vendors/draft-orders", draftOrderBody(), sellerA.headers))).data.draft_order.id
        draftB = (await must("draft B", api.post("/vendors/draft-orders", draftOrderBody(), sellerB.headers))).data.draft_order.id
      })

      it("a seller can read and delete their own draft order", async () => {
        expect((await call(api.get(`/vendors/draft-orders/${draftA}`, sellerA.headers))).status).toBe(200)

        const extra = await must("extra draft", api.post("/vendors/draft-orders", draftOrderBody(), sellerA.headers))
        const del = await call(api.delete(`/vendors/draft-orders/${extra.data.draft_order.id}`, sellerA.headers))
        expect(del.status).toBe(200)
      })

      it("another seller's draft order cannot be read (404)", async () => {
        expect((await call(api.get(`/vendors/draft-orders/${draftB}`, sellerA.headers))).status).toBe(404)
      })

      it("another seller's draft order cannot be deleted (404) and still exists", async () => {
        expect((await call(api.delete(`/vendors/draft-orders/${draftB}`, sellerA.headers))).status).toBe(404)
        expect((await call(api.get(`/vendors/draft-orders/${draftB}`, sellerB.headers))).status).toBe(200)
      })

      it("another seller's draft order cannot be converted (404) and stays a draft", async () => {
        expect((await call(api.post(`/vendors/draft-orders/${draftB}/convert`, {}, sellerA.headers))).status).toBe(404)
        const owner = await call(api.get(`/vendors/draft-orders/${draftB}`, sellerB.headers))
        expect(owner.data.draft_order.is_draft_order).toBe(true)
      })

      it("a draft order cannot be created for a customer the seller has no relation to (404, nothing created)", async () => {
        const before = await orderCount()
        const res = await call(api.post("/vendors/draft-orders", draftOrderBody({ customer_id: customerStranger }), sellerA.headers))
        expect(res.status).toBe(404)
        expect(await orderCount()).toBe(before)
      })

      it("a draft order can be created for the seller's own customer", async () => {
        const res = await call(api.post("/vendors/draft-orders", draftOrderBody({ customer_id: customerA }), sellerA.headers))
        expect({ status: res.status, body: res.status === 201 ? "ok" : res.data }).toEqual({ status: 201, body: "ok" })
      })

      it("a draft order cannot include another seller's variant (404, nothing created)", async () => {
        const before = await orderCount()
        const res = await call(
          api.post("/vendors/draft-orders", draftOrderBody({ items: [{ variant_id: variantB, quantity: 1 }] }), sellerA.headers)
        )
        expect(res.status).toBe(404)
        expect(await orderCount()).toBe(before)
      })

      it("a draft order can include the seller's own variant", async () => {
        const res = await call(
          api.post("/vendors/draft-orders", draftOrderBody({ items: [{ variant_id: variantA, quantity: 1 }] }), sellerA.headers)
        )
        expect({ status: res.status, body: res.status === 201 ? "ok" : res.data }).toEqual({ status: 201, body: "ok" })
      })

      it("a draft order cannot use another seller's sales channel (404, nothing created)", async () => {
        const before = await orderCount()
        const res = await call(api.post("/vendors/draft-orders", draftOrderBody({ sales_channel_id: channelB }), sellerA.headers))
        expect(res.status).toBe(404)
        expect(await orderCount()).toBe(before)
      })

      it("a seller's draft order list shows only their own drafts", async () => {
        const res = await call(api.get("/vendors/draft-orders", sellerA.headers))
        const ids = (res.data.draft_orders ?? []).map((o: any) => o.id)
        expect(ids).toContain(draftA)
        expect(ids).not.toContain(draftB)
      })
    })
  },
})
