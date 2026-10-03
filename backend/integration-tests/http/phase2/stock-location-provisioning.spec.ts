import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 2, step 1 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A new seller location must be able to serve shipping and reservations on its
 * own: a fulfilment set, a service zone for its country, the manual fulfilment
 * provider and a sales channel link. Each seller's set is their own.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller location provisioning", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let locationA: string
      let locationB: string
      let locationNoAddress: string
      let channelId: string

      const graph = async (id: string) => {
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "stock_location",
          fields: [
            "id",
            "fulfillment_sets.id",
            "fulfillment_sets.type",
            "fulfillment_sets.service_zones.id",
            "fulfillment_sets.service_zones.geo_zones.country_code",
            "fulfillment_providers.id",
            "sales_channels.id",
          ],
          filters: { id },
        })
        return data[0] as any
      }

      beforeAll(async () => {
        // The storefront's default channel; every new location is linked to it.
        const salesChannelModule = getContainer().resolve(Modules.SALES_CHANNEL) as any
        const storeModule = getContainer().resolve(Modules.STORE) as any
        const channel = await salesChannelModule.createSalesChannels({ name: "Default" })
        channelId = channel.id
        const [store] = await storeModule.listStores()
        if (store) {
          await storeModule.updateStores(store.id, { default_sales_channel_id: channelId })
        } else {
          await storeModule.createStores({
            name: "Test store",
            supported_currencies: [{ currency_code: "usd", is_default: true }],
            default_sales_channel_id: channelId,
          })
        }

        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        const a = await api.post(
          "/vendors/stock-locations",
          { name: "A warehouse", address: { address_1: "1 Street", city: "Town", country_code: "US" } },
          sellerA.headers
        )
        const b = await api.post(
          "/vendors/stock-locations",
          { name: "B warehouse", address: { address_1: "2 Street", city: "Town", country_code: "de" } },
          sellerB.headers
        )
        const none = await api.post("/vendors/stock-locations", { name: "No address" }, sellerA.headers)
        locationA = a.data.stock_location.id
        locationB = b.data.stock_location.id
        locationNoAddress = none.data.stock_location.id
      })

      it("gives a new location a shipping fulfilment set with a zone for its country", async () => {
        const location = await graph(locationA)
        expect(location.fulfillment_sets).toHaveLength(1)
        expect(location.fulfillment_sets[0].type).toBe("shipping")
        const zones = location.fulfillment_sets[0].service_zones
        expect(zones).toHaveLength(1)
        expect(zones[0].geo_zones.map((g: any) => g.country_code)).toEqual(["us"])
      })

      it("links the manual fulfilment provider and the default sales channel", async () => {
        const location = await graph(locationA)
        expect(location.fulfillment_providers.map((p: any) => p.id)).toContain("manual_manual")
        expect(location.sales_channels.map((c: any) => c.id)).toContain(channelId)
      })

      it("keeps each seller's fulfilment set and zone separate", async () => {
        const a = await graph(locationA)
        const b = await graph(locationB)
        expect(a.fulfillment_sets[0].id).not.toBe(b.fulfillment_sets[0].id)
        expect(a.fulfillment_sets[0].service_zones[0].id).not.toBe(b.fulfillment_sets[0].service_zones[0].id)
        expect(b.fulfillment_sets[0].service_zones[0].geo_zones.map((g: any) => g.country_code)).toEqual(["de"])
      })

      it("still creates a location without an address, with a set but no zone yet", async () => {
        const location = await graph(locationNoAddress)
        expect(location.fulfillment_sets).toHaveLength(1)
        expect(location.fulfillment_sets[0].service_zones).toHaveLength(0)
        expect(location.fulfillment_providers.map((p: any) => p.id)).toContain("manual_manual")
      })
    })
  },
})
