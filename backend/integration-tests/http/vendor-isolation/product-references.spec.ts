import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1 steps 3 and 5 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A product may only point at a stock location or a shipping profile the seller
 * can use (their own, or a shared platform one). Another seller's id answers
 * 404 BEFORE anything is created or changed.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: product references", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let profileA: string
      let profileB: string
      let platformProfile: string
      let locationB: string
      let typeB: string
      let tagB: string
      let platformType: string
      let ownProduct: string

      const fulfillment = () => getContainer().resolve(Modules.FULFILLMENT) as any

      const productCount = async () => {
        const query: any = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({ entity: "product", fields: ["id"] })
        return data.length as number
      }

      const profileOf = async (productId: string) => {
        const query: any = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "product",
          fields: ["id", "shipping_profile.id"],
          filters: { id: productId },
        })
        return data[0]?.shipping_profile?.id as string | undefined
      }

      // Smallest product Medusa accepts: options are mandatory.
      const productBody = (title: string, extra: Record<string, unknown> = {}) => ({
        title,
        options: [{ title: "Size", values: ["M"] }],
        variants: [
          { title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 10 }], manage_inventory: false },
        ],
        ...extra,
      })

      // Show the server's message for a failed setup call (axios hides it).
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

        profileA = (await must("profile A", api.post("/vendors/shipping-profiles", { name: "A profile", type: "default" }, sellerA.headers))).data
          .shipping_profile.id
        profileB = (await must("profile B", api.post("/vendors/shipping-profiles", { name: "B profile", type: "default" }, sellerB.headers))).data
          .shipping_profile.id
        platformProfile = (await fulfillment().createShippingProfiles({ name: "Platform profile", type: "default" })).id

        locationB = (
          await must(
            "location B",
            api.post("/vendors/stock-locations", { name: "B warehouse", address: { address_1: "1 Test Street", city: "Testville", country_code: "us" } }, sellerB.headers)
          )
        ).data.stock_location.id

        typeB = (await must("type B", api.post("/vendors/product-types", { value: "B type" }, sellerB.headers))).data.product_type.id
        tagB = (await must("tag B", api.post("/vendors/product-tags", { value: "b-tag" }, sellerB.headers))).data.product_tag.id
        platformType = (await (getContainer().resolve(Modules.PRODUCT) as any).createProductTypes([{ value: "Platform type" }]))[0].id

        // Data created inside a test is rolled back after it; only setup persists.
        ownProduct = (await must("own product", api.post("/vendors/products", productBody("Own product"), sellerA.headers))).data
          .product.id
      })

      it("a seller with no shipping option yet gets the shared platform profile, so checkout keeps working", async () => {
        const res = await call(api.post("/vendors/products", productBody("A product"), sellerA.headers))
        expect({ status: res.status, body: res.status === 201 ? "ok" : res.data }).toEqual({ status: 201, body: "ok" })
        expect(await profileOf(res.data.product.id)).toBe(platformProfile)
      })

      it("a product can use a shared platform profile", async () => {
        const res = await call(
          api.post("/vendors/products", productBody("Platform profile product", { shipping_profile_id: platformProfile }), sellerA.headers)
        )
        expect(res.status).toBe(201)
        expect(await profileOf(res.data.product.id)).toBe(platformProfile)
      })

      it("a product cannot be created with another seller's shipping profile (404, nothing created)", async () => {
        const before = await productCount()
        const res = await call(
          api.post("/vendors/products", productBody("Stolen profile", { shipping_profile_id: profileB }), sellerA.headers)
        )
        expect(res.status).toBe(404)
        expect(await productCount()).toBe(before)
      })

      it("a product cannot be created with another seller's stock location (404, nothing created)", async () => {
        const before = await productCount()
        const res = await call(
          api.post("/vendors/products", productBody("Stolen location", { stock_location_id: locationB }), sellerA.headers)
        )
        // The body validator may reject the unknown field first (400); either way it is refused.
        expect([400, 404]).toContain(res.status)
        expect(await productCount()).toBe(before)
      })

      it("a product cannot be switched to another seller's shipping profile (404, unchanged)", async () => {
        const res = await call(
          api.post(`/vendors/products/${ownProduct}`, { shipping_profile_id: profileB }, sellerA.headers)
        )
        expect(res.status).toBe(404)
        expect(await profileOf(ownProduct)).toBe(platformProfile)
      })

      it("a product cannot be created with another seller's type (404, nothing created)", async () => {
        const before = await productCount()
        const res = await call(api.post("/vendors/products", productBody("Stolen type", { type_id: typeB }), sellerA.headers))
        expect(res.status).toBe(404)
        expect(await productCount()).toBe(before)
      })

      it("a product cannot be created with another seller's tag (404, nothing created)", async () => {
        const before = await productCount()
        const res = await call(
          api.post("/vendors/products", productBody("Stolen tag", { tags: [{ id: tagB }] }), sellerA.headers)
        )
        expect(res.status).toBe(404)
        expect(await productCount()).toBe(before)
      })

      it("a product can use a shared platform type", async () => {
        const res = await call(api.post("/vendors/products", productBody("Platform type product", { type_id: platformType }), sellerA.headers))
        expect(res.status).toBe(201)
      })

      it("a product cannot be switched to another seller's type (404)", async () => {
        const res = await call(api.post(`/vendors/products/${ownProduct}`, { type_id: typeB }, sellerA.headers))
        expect(res.status).toBe(404)
      })

      it("a product can be switched to the seller's own profile", async () => {
        const res = await call(
          api.post(`/vendors/products/${ownProduct}`, { shipping_profile_id: platformProfile }, sellerA.headers)
        )
        expect(res.status).toBe(200)
      })
    })
  },
})
