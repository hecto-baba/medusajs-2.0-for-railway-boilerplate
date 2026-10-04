import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../../../src/modules/appointment-booking"
import { disableStockTracking, isOfferedAsService } from "../../../src/lib/service-stock"
import { onboardingStore } from "../../../src/lib/onboarding-store"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import { createSellerProduct, setUpSeller } from "../helpers/checkout"

jest.setTimeout(10 * 60 * 1000)

/**
 * A bookable service has no stock to count. Medusa refuses to add a variant that
 * tracks stock but has none, so offering a product as a service must switch
 * tracking off - and a physical product must be left alone.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("stock tracking for bookable services", () => {
      let seller: TestVendor
      let profile: string
      let n = 0

      const products = () => getContainer().resolve(Modules.PRODUCT) as any
      const appointments = () => getContainer().resolve(APPOINTMENT_BOOKING_MODULE) as any

      beforeAll(async () => {
        seller = await createTestVendor(api, "svc")
        onboardingStore.approve(seller.vendorId)
        profile = (await setUpSeller(api, getContainer(), seller, "svc", 20)).profile
      })

      // A product whose variant tracks stock (as a normal new product does).
      const trackedProduct = async () => {
        const product = await createSellerProduct(api, seller, profile, `Item ${++n}`, 30)
        await products().updateProductVariants({ id: [product.variants[0].id] }, { manage_inventory: true })
        return { id: product.id as string, variantId: product.variants[0].id as string }
      }

      const tracks = async (variantId: string) =>
        (await products().retrieveProductVariant(variantId, { select: ["id", "manage_inventory"] })).manage_inventory

      const makeResource = async () =>
        appointments().createProviders({
          vendor_id: seller.vendorId,
          display_name: `Room ${++n}`,
          timezone: "UTC",
        })

      it("offering a product from a resource switches its stock tracking off, and leaves other products alone", async () => {
        const service = await trackedProduct()
        const physical = await trackedProduct()
        const resource = await makeResource()
        expect(await tracks(service.variantId)).toBe(true)

        const res = await call(
          api.post(
            `/vendors/resources/${resource.id}/services`,
            { services: [{ product_id: service.id }] },
            seller.headers
          )
        )
        expect(res.status).toBe(200)

        expect(await tracks(service.variantId)).toBe(false)
        expect(await tracks(physical.variantId)).toBe(true)
      })

      it("a seller cannot switch tracking back on for a service variant", async () => {
        const service = await trackedProduct()
        const resource = await makeResource()
        await call(
          api.post(`/vendors/resources/${resource.id}/services`, { services: [{ product_id: service.id }] }, seller.headers)
        )
        expect(await tracks(service.variantId)).toBe(false)

        const res = await call(
          api.post(
            `/vendors/products/${service.id}/variants/${service.variantId}`,
            { manage_inventory: true },
            seller.headers
          )
        )
        expect(res.status).toBe(200)
        expect(await tracks(service.variantId)).toBe(false)
      })

      it("a physical product can still switch tracking on", async () => {
        const physical = await trackedProduct()
        await products().updateProductVariants({ id: [physical.variantId] }, { manage_inventory: false })

        const res = await call(
          api.post(
            `/vendors/products/${physical.id}/variants/${physical.variantId}`,
            { manage_inventory: true },
            seller.headers
          )
        )
        expect(res.status).toBe(200)
        expect(await tracks(physical.variantId)).toBe(true)
      })

      it("is idempotent, and reports whether a product is a service", async () => {
        const service = await trackedProduct()
        expect(await isOfferedAsService(getContainer(), service.id)).toBe(false)

        const resource = await makeResource()
        await appointments().createServiceProviders({
          provider_id: resource.id,
          service_product_id: service.id,
          default_duration_minutes: 30,
        })
        expect(await isOfferedAsService(getContainer(), service.id)).toBe(true)

        expect(await disableStockTracking(getContainer(), [service.id])).toBe(1)
        expect(await disableStockTracking(getContainer(), [service.id])).toBe(0)
        expect(await disableStockTracking(getContainer(), [])).toBe(0)
        expect(await tracks(service.variantId)).toBe(false)
      })
    })
  },
})
