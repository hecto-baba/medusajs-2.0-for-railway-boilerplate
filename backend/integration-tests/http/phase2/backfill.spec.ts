import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { runPhase2Backfill } from "../../../src/lib/phase2-backfill"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 2, step 5 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * Builds a seller as they were BEFORE Phase 2 (products on a shared platform
 * profile, a location with no fulfilment set) next to a seller already on the
 * new model, then checks the backfill: dry run writes nothing, apply fixes the
 * old seller only, a second run finds nothing, and unowned records are only
 * reported.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("phase 2 backfill", () => {
      let legacy: TestVendor
      let modern: TestVendor
      let platformProfile: string
      let legacyProduct: string
      let modernProduct: string
      let modernProfile: string
      let legacyLocation: string
      let channelId: string

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      const productBody = (title: string, profile: string) => ({
        title,
        shipping_profile_id: profile,
        options: [{ title: "Size", values: ["M"] }],
        variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 10 }], manage_inventory: false }],
      })

      const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY) as any

      const profileOf = async (productId: string) =>
        (await query().graph({ entity: "product", fields: ["id", "shipping_profile.id"], filters: { id: productId } })).data[0]
          ?.shipping_profile?.id as string | undefined

      const locationState = async (id: string) =>
        (
          await query().graph({
            entity: "stock_location",
            fields: [
              "id",
              "fulfillment_sets.id",
              "fulfillment_sets.service_zones.geo_zones.country_code",
              "fulfillment_providers.id",
              "sales_channels.id",
            ],
            filters: { id },
          })
        ).data[0] as any

      const ownProfilesOf = async (vendorId: string) =>
        ((await query().graph({ entity: "vendor", fields: ["id", "shipping_profiles.id"], filters: { id: vendorId } })).data[0]
          ?.shipping_profiles ?? []) as Array<{ id: string }>

      beforeAll(async () => {
        const container = getContainer()
        const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any
        const storeModule = container.resolve(Modules.STORE) as any
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

        legacy = await createTestVendor(api, "legacy")
        modern = await createTestVendor(api, "modern")

        platformProfile = (await (container.resolve(Modules.FULFILLMENT) as any).createShippingProfiles({ name: "Platform profile", type: "default" })).id

        // Legacy seller: a product on the shared platform profile, and a location
        // made the old way (linked to the seller, no fulfilment set).
        legacyProduct = (await must("legacy product", api.post("/vendors/products", productBody("Legacy product", platformProfile), legacy.headers))).data.product.id
        const location = await (container.resolve(Modules.STOCK_LOCATION) as any).createStockLocations({
          name: "Legacy warehouse",
          address: { address_1: "1 Old Street", city: "Oldtown", country_code: "us" },
        })
        legacyLocation = location.id
        await (container.resolve(ContainerRegistrationKeys.LINK) as any).create({
          [MARKETPLACE_MODULE]: { vendor_id: legacy.vendorId },
          [Modules.STOCK_LOCATION]: { stock_location_id: legacyLocation },
        })

        // Modern seller: already on the new model.
        modernProfile = (await must("modern profile", api.post("/vendors/shipping-profiles", { name: "Modern profile", type: "default" }, modern.headers))).data.shipping_profile.id
        modernProduct = (await must("modern product", api.post("/vendors/products", productBody("Modern product", modernProfile), modern.headers))).data.product.id
        await must("modern location", api.post("/vendors/stock-locations", { name: "Modern wh", address: { address_1: "1 St", city: "Town", country_code: "us" } }, modern.headers))

        // A product that belongs to nobody.
        await (container.resolve(Modules.PRODUCT) as any).createProducts({ title: "Orphan product" })
      })

      it("dry run reports and writes nothing; apply fixes the old seller only; a second run finds nothing", async () => {
        const container = getContainer()

        // Dry run.
        const dry = await runPhase2Backfill(container)
        expect(dry.applied).toBe(false)
        expect(dry.profilesToCreate).toEqual([legacy.vendorId])
        expect(dry.productsToMove).toEqual([{ product_id: legacyProduct, vendor_id: legacy.vendorId }])
        expect(dry.locationsToProvision.map((l) => l.location_id)).toEqual([legacyLocation])
        expect(dry.needsAttention.unownedProducts).toBe(1)
        expect(await profileOf(legacyProduct)).toBe(platformProfile)
        expect((await ownProfilesOf(legacy.vendorId)).length).toBe(0)
        expect((await locationState(legacyLocation)).fulfillment_sets).toHaveLength(0)

        // Apply.
        const applied = await runPhase2Backfill(container, { apply: true })
        expect(applied.applied).toBe(true)

        const ownProfiles = await ownProfilesOf(legacy.vendorId)
        expect(ownProfiles).toHaveLength(1)
        expect(await profileOf(legacyProduct)).toBe(ownProfiles[0].id)

        const location = await locationState(legacyLocation)
        expect(location.fulfillment_sets).toHaveLength(1)
        expect(location.fulfillment_sets[0].service_zones[0].geo_zones.map((g: any) => g.country_code)).toEqual(["us"])
        expect(location.fulfillment_providers.map((p: any) => p.id)).toContain("manual_manual")
        expect(location.sales_channels.map((c: any) => c.id)).toContain(channelId)

        // The seller already on the new model is untouched.
        expect(await profileOf(modernProduct)).toBe(modernProfile)
        expect((await ownProfilesOf(modern.vendorId)).map((p) => p.id)).toEqual([modernProfile])

        // A second run has nothing left to do, and still only reports the unowned product.
        const again = await runPhase2Backfill(container, { apply: true })
        expect(again.profilesToCreate).toEqual([])
        expect(again.productsToMove).toEqual([])
        expect(again.locationsToProvision).toEqual([])
        expect(again.needsAttention.unownedProducts).toBe(1)
      })
    })
  },
})
