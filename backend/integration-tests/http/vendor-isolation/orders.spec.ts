import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 17 of docs/tenant-isolation-and-multi-tenancy.md (interim).
 *
 * Today one cart yields ONE order, and Medusa allows one seller per order link, so
 * an order can contain items of several sellers while being linked to one. The
 * seller routes trimmed the items but still returned whole-order figures: the
 * payment, shipping methods and the shipping, tax and discount totals, which
 * include other sellers' items. When an order is mixed, those are now withheld.
 * An order that is entirely the seller's is unchanged. Phase 3 (one order per
 * seller) removes the problem.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: orders with other sellers' items", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let mixedOrder: string
      let ownOrder: string
      let variantA: string
      let variantB: string
      let productA: string
      let productB: string

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      const productBody = (title: string) => ({
        title,
        options: [{ title: "Size", values: ["M"] }],
        variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 10 }], manage_inventory: false }],
      })

      const createOrder = async (email: string, items: any[]) => {
        const container = getContainer()
        const orderModule = container.resolve(Modules.ORDER) as any
        const order = await orderModule.createOrders({
          currency_code: "usd",
          email,
          items,
          shipping_methods: [{ name: "Standard", amount: 1000 }],
        })

        const paymentModule = container.resolve(Modules.PAYMENT) as any
        const collection = await paymentModule.createPaymentCollections({ currency_code: "usd", amount: 5000 })

        const link: any = container.resolve(ContainerRegistrationKeys.LINK)
        await link.create({ [MARKETPLACE_MODULE]: { vendor_id: sellerA.vendorId }, [Modules.ORDER]: { order_id: order.id } })
        await link.create({ [Modules.ORDER]: { order_id: order.id }, [Modules.PAYMENT]: { payment_collection_id: collection.id } })
        return order.id as string
      }

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        const pA = (await must("product A", api.post("/vendors/products", productBody("A product"), sellerA.headers))).data.product
        const pB = (await must("product B", api.post("/vendors/products", productBody("B product"), sellerB.headers))).data.product
        productA = pA.id
        productB = pB.id
        variantA = pA.variants[0].id
        variantB = pB.variants[0].id

        // A mixed cart: items of both sellers, linked to seller A only.
        mixedOrder = await createOrder("mixed@example.com", [
          { title: "A item", quantity: 1, unit_price: 100, product_id: productA, variant_id: variantA },
          { title: "B item", quantity: 1, unit_price: 200, product_id: productB, variant_id: variantB },
        ])
        // An order that is entirely seller A's.
        ownOrder = await createOrder("own@example.com", [
          { title: "A item", quantity: 2, unit_price: 100, product_id: productA, variant_id: variantA },
        ])
      })

      const detail = async (id: string) => {
        const res = await call(api.get(`/vendors/orders/${id}`, sellerA.headers))
        expect(res.status).toBe(200)
        return res.data.order
      }

      const listed = async (id: string) => {
        const res = await call(api.get("/vendors/orders?limit=100", sellerA.headers))
        expect(res.status).toBe(200)
        return (res.data.orders ?? []).find((o: any) => o.id === id)
      }

      it("a mixed order shows the seller only their own items", async () => {
        const order = await detail(mixedOrder)
        expect(order.items.map((i: any) => i.title)).toEqual(["A item"])
      })

      it("a mixed order withholds the whole-order payment and shipping figures (detail)", async () => {
        const order = await detail(mixedOrder)
        expect(order.payment_collections ?? []).toEqual([])
        expect(order.shipping_methods ?? []).toEqual([])
        expect(order.fulfillments ?? []).toEqual([])
        expect(order.shipping_total ?? null).toBeNull()
        expect(order.tax_total ?? null).toBeNull()
      })

      it("a mixed order withholds the same figures in the list", async () => {
        const order = await listed(mixedOrder)
        expect(order).toBeDefined()
        expect(order.items.map((i: any) => i.title)).toEqual(["A item"])
        expect(order.payment_collections ?? []).toEqual([])
        expect(order.shipping_methods ?? []).toEqual([])
        expect(order.shipping_total ?? null).toBeNull()
      })

      it("an order that is entirely the seller's keeps its payment and shipping (detail and list)", async () => {
        const order = await detail(ownOrder)
        expect((order.payment_collections ?? []).length).toBe(1)
        expect((order.shipping_methods ?? []).length).toBe(1)

        const row = await listed(ownOrder)
        expect((row.payment_collections ?? []).length).toBe(1)
        expect((row.shipping_methods ?? []).length).toBe(1)
      })

      it("the order's total for the seller is still the sum of their own items", async () => {
        const order = await detail(mixedOrder)
        expect(Number(order.total)).toBe(100)
      })

      it("another seller cannot read the order at all (404)", async () => {
        expect((await call(api.get(`/vendors/orders/${mixedOrder}`, sellerB.headers))).status).toBe(404)
      })
    })
  },
})
