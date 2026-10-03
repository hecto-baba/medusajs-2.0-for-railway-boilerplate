import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 9 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * Products may only be placed in a collection the seller can use (their own or
 * a shared platform one) and in categories that are not internal. Another
 * seller's collection and any internal category answer 404 before anything
 * changes. Internal categories are never listed to sellers.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: collection and category references", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let collectionA: string
      let collectionB: string
      let platformCollection: string
      let publicCategory: string
      let internalCategory: string
      let productA: string

      const productModule = () => getContainer().resolve(Modules.PRODUCT) as any

      const productBody = (title: string, extra: Record<string, unknown> = {}) => ({
        title,
        options: [{ title: "Size", values: ["M"] }],
        variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 10 }], manage_inventory: false }],
        ...extra,
      })

      const productCount = async () => {
        const query: any = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({ entity: "product", fields: ["id"] })
        return data.length as number
      }

      const collectionOf = async (productId: string) => (await productModule().retrieveProduct(productId)).collection_id as string | null

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

        collectionA = (await must("collection A", api.post("/vendors/collections", { title: "A collection" }, sellerA.headers))).data.collection.id
        collectionB = (await must("collection B", api.post("/vendors/collections", { title: "B collection" }, sellerB.headers))).data.collection.id
        platformCollection = (await productModule().createProductCollections([{ title: "Platform collection" }]))[0].id

        const categories = await productModule().createProductCategories([
          { name: "Public category", is_active: true, is_internal: false },
          { name: "Internal category", is_active: true, is_internal: true },
        ])
        publicCategory = categories.find((c: any) => c.name === "Public category").id
        internalCategory = categories.find((c: any) => c.name === "Internal category").id

        productA = (await must("product A", api.post("/vendors/products", productBody("A product"), sellerA.headers))).data.product.id
      })

      it("a product can be created in the seller's own collection and a shared platform collection", async () => {
        expect((await call(api.post("/vendors/products", productBody("Own collection", { collection_id: collectionA }), sellerA.headers))).status).toBe(201)
        expect(
          (await call(api.post("/vendors/products", productBody("Platform collection", { collection_id: platformCollection }), sellerA.headers))).status
        ).toBe(201)
      })

      it("a product cannot be created in another seller's collection (404, nothing created)", async () => {
        const before = await productCount()
        const res = await call(api.post("/vendors/products", productBody("Stolen", { collection_id: collectionB }), sellerA.headers))
        expect(res.status).toBe(404)
        expect(await productCount()).toBe(before)
      })

      it("a product cannot be moved into another seller's collection (404, unchanged)", async () => {
        const res = await call(api.post(`/vendors/products/${productA}`, { collection_id: collectionB }, sellerA.headers))
        expect(res.status).toBe(404)
        expect(await collectionOf(productA)).toBeNull()
      })

      it("the collection products route refuses another seller's collection (404) and accepts the seller's own", async () => {
        expect((await call(api.post(`/vendors/collections/${collectionB}/products`, { add: [productA] }, sellerA.headers))).status).toBe(404)
        expect(await collectionOf(productA)).toBeNull()

        expect((await call(api.post(`/vendors/collections/${collectionA}/products`, { add: [productA] }, sellerA.headers))).status).toBe(200)
        expect(await collectionOf(productA)).toBe(collectionA)
      })

      it("a product cannot be created in an internal category (404, nothing created)", async () => {
        const before = await productCount()
        const res = await call(
          api.post("/vendors/products", productBody("Internal", { categories: [{ id: internalCategory }] }), sellerA.headers)
        )
        expect(res.status).toBe(404)
        expect(await productCount()).toBe(before)
      })

      it("the category products route refuses an internal category (404) and accepts a public one", async () => {
        expect((await call(api.post(`/vendors/categories/${internalCategory}/products`, { add: [productA] }, sellerA.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/categories/${publicCategory}/products`, { add: [productA] }, sellerA.headers))).status).toBe(200)
      })

      it("internal categories are not listed or readable by a seller", async () => {
        const list = await call(api.get("/vendors/categories", sellerA.headers))
        const ids = (list.data.categories ?? []).map((c: any) => c.id)
        expect(ids).toContain(publicCategory)
        expect(ids).not.toContain(internalCategory)

        expect((await call(api.get(`/vendors/categories/${internalCategory}`, sellerA.headers))).status).toBe(404)
        expect((await call(api.get(`/vendors/categories/${publicCategory}`, sellerA.headers))).status).toBe(200)
      })
    })
  },
})
