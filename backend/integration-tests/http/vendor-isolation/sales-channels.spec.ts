import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 4 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A seller sees and uses their OWN channels plus shared PLATFORM channels
 * (linked to no seller). They can edit and delete only their own. Another
 * seller's channel answers 404 everywhere and is never listed.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: sales channels", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let sellerWithNothing: TestVendor
      let channelA: string
      let channelB: string
      let platformChannel: string

      const salesChannelModule = () => getContainer().resolve(Modules.SALES_CHANNEL) as any
      const ids = (res: { data: any }) => (res.data.sales_channels ?? []).map((c: any) => c.id)

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        sellerWithNothing = await createTestVendor(api, "empty")

        channelA = (await api.post("/vendors/sales-channels", { name: "A channel" }, sellerA.headers)).data.sales_channel.id
        channelB = (await api.post("/vendors/sales-channels", { name: "B channel" }, sellerB.headers)).data.sales_channel.id
        platformChannel = (await salesChannelModule().createSalesChannels({ name: "Platform channel" })).id
      })

      it("a seller can read, update and delete their own channel", async () => {
        expect((await call(api.get(`/vendors/sales-channels/${channelA}`, sellerA.headers))).status).toBe(200)

        const renamed = await call(
          api.post(`/vendors/sales-channels/${channelA}`, { name: "A channel renamed" }, sellerA.headers)
        )
        expect(renamed.status).toBe(200)

        const extra = await api.post("/vendors/sales-channels", { name: "A throwaway" }, sellerA.headers)
        const del = await call(api.delete(`/vendors/sales-channels/${extra.data.sales_channel.id}`, sellerA.headers))
        expect(del.status).toBe(200)
      })

      it("another seller's channel cannot be read (404)", async () => {
        expect((await call(api.get(`/vendors/sales-channels/${channelB}`, sellerA.headers))).status).toBe(404)
      })

      it("another seller's channel cannot be renamed (404) and is unchanged", async () => {
        const res = await call(api.post(`/vendors/sales-channels/${channelB}`, { name: "hijacked" }, sellerA.headers))
        expect(res.status).toBe(404)
        const stored = await salesChannelModule().retrieveSalesChannel(channelB)
        expect(stored.name).toBe("B channel")
      })

      it("another seller's channel cannot be deleted (404) and still exists", async () => {
        expect((await call(api.delete(`/vendors/sales-channels/${channelB}`, sellerA.headers))).status).toBe(404)
        const stored = await salesChannelModule().retrieveSalesChannel(channelB)
        expect(stored.id).toBe(channelB)
      })

      it("another seller's channel cannot have products added or removed (404)", async () => {
        const res = await call(
          api.post(`/vendors/sales-channels/${channelB}/products`, { add: [], remove: [] }, sellerA.headers)
        )
        expect(res.status).toBe(404)
      })

      it("a list shows the seller's own and platform channels, never another seller's", async () => {
        const res = await call(api.get("/vendors/sales-channels", sellerA.headers))
        expect(ids(res)).toContain(channelA)
        expect(ids(res)).toContain(platformChannel)
        expect(ids(res)).not.toContain(channelB)
      })

      it("a seller with no channels sees platform channels but no other seller's", async () => {
        const res = await call(api.get("/vendors/sales-channels", sellerWithNothing.headers))
        expect(res.status).toBe(200)
        // Medusa also creates its own default channel at startup; that is a platform channel too.
        expect(ids(res)).toContain(platformChannel)
        expect(ids(res)).not.toContain(channelA)
        expect(ids(res)).not.toContain(channelB)
      })

      it("a platform channel is readable and usable but cannot be edited or deleted", async () => {
        expect((await call(api.get(`/vendors/sales-channels/${platformChannel}`, sellerA.headers))).status).toBe(200)
        expect(
          (await call(api.post(`/vendors/sales-channels/${platformChannel}/products`, { add: [] }, sellerA.headers))).status
        ).toBe(200)

        expect(
          (await call(api.post(`/vendors/sales-channels/${platformChannel}`, { name: "hijacked" }, sellerA.headers))).status
        ).toBe(404)
        expect((await call(api.delete(`/vendors/sales-channels/${platformChannel}`, sellerA.headers))).status).toBe(404)

        const stored = await salesChannelModule().retrieveSalesChannel(platformChannel)
        expect(stored.name).toBe("Platform channel")
      })
    })
  },
})
