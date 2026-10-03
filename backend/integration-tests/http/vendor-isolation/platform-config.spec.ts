import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 15 of docs/tenant-isolation-and-multi-tenancy.md (decision D6).
 *
 * Regions and country tax regions are the platform's: a cart picks ONE region by
 * country, and Medusa allows only ONE tax region per country, so a seller cannot
 * own either. Sellers may read them (a price needs a currency, a tax rate shows
 * what applies) but not create, change or delete them. Before, any seller could
 * add a region or rewrite a platform tax rate. Seller-specific tax arrives in
 * Phase 2 as seller-owned rates, not as regions.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer, dbConfig }) => {
    describe("seller isolation: platform regions and tax", () => {
      let seller: TestVendor
      let regionId: string
      let taxRegionId: string

      const regionModule = () => getContainer().resolve(Modules.REGION) as any
      const taxModule = () => getContainer().resolve(Modules.TAX) as any

      const regionCount = async () => (await regionModule().listRegions({})).length as number
      const taxRegionCount = async () => (await taxModule().listTaxRegions({})).length as number

      const defaultRate = async () => {
        const rates = await taxModule().listTaxRates({ tax_region_id: [taxRegionId] })
        return rates[0]?.rate as number | undefined
      }

      beforeAll(async () => {
        // The tax region routes read through their own database pool, created on
        // first use from DATABASE_URL: point it at the test database.
        process.env.DATABASE_URL = dbConfig.clientUrl

        seller = await createTestVendor(api, "a")

        regionId = (await regionModule().createRegions({ name: "Platform region", currency_code: "usd", countries: ["us"] })).id
        taxRegionId = (
          await taxModule().createTaxRegions({
            country_code: "gb",
            default_tax_rate: { rate: 20, name: "VAT", code: "VAT" },
          })
        ).id
      })

      it("a seller can read regions and tax regions", async () => {
        const regions = await call(api.get("/vendors/regions", seller.headers))
        expect(regions.status).toBe(200)
        expect((regions.data.regions ?? []).map((r: any) => r.id)).toContain(regionId)

        const taxRegions = await call(api.get("/vendors/tax-regions", seller.headers))
        expect(taxRegions.status).toBe(200)
      })

      it("a seller cannot create a region (403) and none is created", async () => {
        const before = await regionCount()
        const res = await call(
          api.post("/vendors/regions", { name: "Seller region", currency_code: "eur", countries: ["fr"] }, seller.headers)
        )
        expect(res.status).toBe(403)
        expect(await regionCount()).toBe(before)
      })

      it("a seller cannot create a tax region (403) and none is created", async () => {
        const before = await taxRegionCount()
        const res = await call(api.post("/vendors/tax-regions", { country_code: "fr", rate: 5 }, seller.headers))
        expect(res.status).toBe(403)
        expect(await taxRegionCount()).toBe(before)
      })

      it("a seller cannot change a platform tax rate (403) and it is unchanged", async () => {
        const res = await call(api.post(`/vendors/tax-regions/${taxRegionId}`, { rate: 1 }, seller.headers))
        expect(res.status).toBe(403)
        expect(await defaultRate()).toBe(20)
      })

      it("a seller cannot delete a tax region (403) and it still exists", async () => {
        const res = await call(api.delete(`/vendors/tax-regions/${taxRegionId}`, seller.headers))
        expect(res.status).toBe(403)
        expect((await taxModule().listTaxRegions({ id: [taxRegionId] })).length).toBe(1)
      })
    })
  },
})
