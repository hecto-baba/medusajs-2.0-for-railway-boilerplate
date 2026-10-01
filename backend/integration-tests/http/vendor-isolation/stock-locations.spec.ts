import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(120 * 1000)

/**
 * Phase 1, step 3 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A seller who types another seller's stock location id by hand must get 404
 * on read, update and delete, and must never see it in a list.
 *
 * STATUS: written against the current routes, which are KNOWN UNSAFE
 * (stock-locations/[id] has no ownership check and the list falls back to every
 * location). These tests are expected to FAIL until the Phase 1 step 3 fix, and
 * they need a Postgres server (see DB_* variables in
 * node_modules/@medusajs/test-utils/dist/database.js). Not yet run.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api }) => {
    describe("seller isolation: stock locations", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let sellerWithNothing: TestVendor
      let locationA: string
      let locationB: string

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
      })

      it("a seller can read, update and delete their own location", async () => {
        const read = await call(api.get(`/vendors/stock-locations/${locationA}`, sellerA.headers))
        expect(read.status).toBe(200)

        const update = await call(
          api.post(`/vendors/stock-locations/${locationA}`, { name: "A warehouse renamed" }, sellerA.headers)
        )
        expect(update.status).toBe(200)
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

      it("a list shows only the seller's own locations", async () => {
        const res = await call(api.get("/vendors/stock-locations", sellerA.headers))
        const ids = (res.data.stock_locations ?? []).map((l: any) => l.id)
        expect(ids).toContain(locationA)
        expect(ids).not.toContain(locationB)
      })

      it("a seller with no locations sees an empty list, not the whole store", async () => {
        const res = await call(api.get("/vendors/stock-locations", sellerWithNothing.headers))
        expect(res.status).toBe(200)
        expect(res.data.stock_locations).toEqual([])
      })
    })
  },
})
