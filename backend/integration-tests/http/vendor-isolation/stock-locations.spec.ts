import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

// The runner creates and migrates a throwaway database before the first test.
jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 3 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A seller sees and uses their OWN locations plus shared PLATFORM locations
 * (linked to no seller). They can edit and delete only their own. Another
 * seller's location answers 404 on read, update and delete and is never listed.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: stock locations", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let sellerWithNothing: TestVendor
      let locationA: string
      let locationB: string
      let platformLocation: string

      const stockLocationModule = () => getContainer().resolve(Modules.STOCK_LOCATION) as any

      const newLocation = (name: string) => ({
        name,
        address: { address_1: "1 Test Street", city: "Testville", country_code: "us" },
      })

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        sellerWithNothing = await createTestVendor(api, "empty")

        const a = await api.post("/vendors/stock-locations", newLocation("A warehouse"), sellerA.headers)
        const b = await api.post("/vendors/stock-locations", newLocation("B warehouse"), sellerB.headers)
        locationA = a.data.stock_location.id
        locationB = b.data.stock_location.id

        // A location that belongs to no seller.
        const platform = await stockLocationModule().createStockLocations({ name: "Platform warehouse" })
        platformLocation = platform.id
      })

      it("a seller can read, update and delete their own location", async () => {
        const read = await call(api.get(`/vendors/stock-locations/${locationA}`, sellerA.headers))
        expect(read.status).toBe(200)

        const update = await call(
          api.post(`/vendors/stock-locations/${locationA}`, { name: "A warehouse renamed" }, sellerA.headers)
        )
        expect(update.status).toBe(200)

        const extra = await call(api.post("/vendors/stock-locations", newLocation("A throwaway"), sellerA.headers))
        const del = await call(api.delete(`/vendors/stock-locations/${extra.data.stock_location.id}`, sellerA.headers))
        expect(del.status).toBe(200)
      })

      it("another seller gets 404 reading it", async () => {
        const res = await call(api.get(`/vendors/stock-locations/${locationB}`, sellerA.headers))
        expect(res.status).toBe(404)
      })

      it("another seller gets 404 updating it, and it is unchanged", async () => {
        const res = await call(
          api.post(`/vendors/stock-locations/${locationB}`, { name: "hijacked" }, sellerA.headers)
        )
        expect(res.status).toBe(404)

        const owner = await call(api.get(`/vendors/stock-locations/${locationB}`, sellerB.headers))
        expect(owner.data.stock_location.name).toBe("B warehouse")
      })

      it("another seller gets 404 deleting it, and it still exists", async () => {
        const res = await call(api.delete(`/vendors/stock-locations/${locationB}`, sellerA.headers))
        expect(res.status).toBe(404)

        const owner = await call(api.get(`/vendors/stock-locations/${locationB}`, sellerB.headers))
        expect(owner.status).toBe(200)
      })

      it("a list shows only the seller's own locations: another seller's never, a platform one only where they hold stock", async () => {
        const res = await call(api.get("/vendors/stock-locations", sellerA.headers))
        const ids = (res.data.stock_locations ?? []).map((l: any) => l.id)
        expect(ids).toContain(locationA)
        // Phase 2 retired the platform location from seller view (see platform-leftovers.spec.ts
        // for the seller who still holds stock there).
        expect(ids).not.toContain(platformLocation)
        expect(ids).not.toContain(locationB)
      })

      it("a seller with no locations sees none: not the platform's, not other sellers'", async () => {
        const res = await call(api.get("/vendors/stock-locations", sellerWithNothing.headers))
        expect(res.status).toBe(200)
        const ids = (res.data.stock_locations ?? []).map((l: any) => l.id)
        expect(ids).toEqual([])
      })

      it("a platform location is not visible, and cannot be edited or deleted, by a seller with no stock there", async () => {
        const read = await call(api.get(`/vendors/stock-locations/${platformLocation}`, sellerA.headers))
        expect(read.status).toBe(404)

        const update = await call(
          api.post(`/vendors/stock-locations/${platformLocation}`, { name: "hijacked" }, sellerA.headers)
        )
        expect(update.status).toBe(404)

        const del = await call(api.delete(`/vendors/stock-locations/${platformLocation}`, sellerA.headers))
        expect(del.status).toBe(404)

        const stored = await stockLocationModule().retrieveStockLocation(platformLocation)
        expect(stored.name).toBe("Platform warehouse")
      })

      it("the taxonomy lookup lists the same visible locations only", async () => {
        const res = await call(api.get("/vendors/taxonomy", sellerA.headers))
        expect(res.status).toBe(200)
        const ids = (res.data.stock_locations ?? []).map((l: any) => l.id)
        expect(ids).toContain(locationA)
        expect(ids).not.toContain(locationB)

        // The old fallback leaked every location to a seller that owned none.
        const empty = await call(api.get("/vendors/taxonomy", sellerWithNothing.headers))
        const emptyIds = (empty.data.stock_locations ?? []).map((l: any) => l.id)
        expect(emptyIds).toEqual([])
      })
    })
  },
})
