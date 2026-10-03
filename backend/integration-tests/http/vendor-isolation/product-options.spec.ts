import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 6 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A product option belongs to a seller when it is linked to them or belongs to
 * one of their products. Another seller's option answers 404 on read, update
 * and delete, is never listed, and cannot be attached to by naming a product
 * that is not yours.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: product options", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let optionA: string
      let optionB: string
      let standaloneB: string
      let productB: string

      const productModule = () => getContainer().resolve(Modules.PRODUCT) as any
      const ids = (res: { data: any }) => (res.data.product_options ?? []).map((o: any) => o.id)

      const productBody = (title: string) => ({
        title,
        options: [{ title: "Size", values: ["M"] }],
        variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 10 }], manage_inventory: false }],
      })

      const optionOf = async (productId: string) => {
        const product = await productModule().retrieveProduct(productId, { relations: ["options"] })
        return product.options[0].id as string
      }

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        const pA = (await api.post("/vendors/products", productBody("A product"), sellerA.headers)).data.product.id
        productB = (await api.post("/vendors/products", productBody("B product"), sellerB.headers)).data.product.id
        optionA = await optionOf(pA)
        optionB = await optionOf(productB)

        standaloneB = (
          await api.post("/vendors/product-options", { title: "B standalone", values: ["x"] }, sellerB.headers)
        ).data.product_option.id
      })

      it("a seller can read and update the options of their own product", async () => {
        expect((await call(api.get(`/vendors/product-options/${optionA}`, sellerA.headers))).status).toBe(200)
        const res = await call(api.post(`/vendors/product-options/${optionA}`, { title: "Size renamed" }, sellerA.headers))
        expect(res.status).toBe(200)
      })

      it("another seller's product option cannot be read (404)", async () => {
        expect((await call(api.get(`/vendors/product-options/${optionB}`, sellerA.headers))).status).toBe(404)
      })

      it("another seller's standalone option cannot be read (404)", async () => {
        expect((await call(api.get(`/vendors/product-options/${standaloneB}`, sellerA.headers))).status).toBe(404)
      })

      it("another seller's option cannot be renamed (404) and is unchanged", async () => {
        const res = await call(api.post(`/vendors/product-options/${optionB}`, { title: "hijacked" }, sellerA.headers))
        expect(res.status).toBe(404)
        const stored = await productModule().retrieveProductOption(optionB)
        expect(stored.title).toBe("Size")
      })

      it("another seller's option cannot be deleted (404) and still exists", async () => {
        expect((await call(api.delete(`/vendors/product-options/${standaloneB}`, sellerA.headers))).status).toBe(404)
        const stored = await productModule().retrieveProductOption(standaloneB)
        expect(stored.id).toBe(standaloneB)
      })

      it("an option cannot be created on another seller's product (404)", async () => {
        const res = await call(
          api.post("/vendors/product-options", { title: "Colour", values: ["red"], product_id: productB }, sellerA.headers)
        )
        expect(res.status).toBe(404)
      })

      it("a list shows only the seller's own options", async () => {
        const res = await call(api.get("/vendors/product-options", sellerA.headers))
        expect(ids(res)).toContain(optionA)
        expect(ids(res)).not.toContain(optionB)
        expect(ids(res)).not.toContain(standaloneB)
      })
    })
  },
})
