import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  cancelOrderWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
} from "@medusajs/medusa/core-flows"
import createDigitalProductWorkflow from "../../../src/workflows/create-digital-product"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import {
  CartItem,
  completeCart,
  createSellerProduct,
  must,
  setUpSeller,
  setUpStorefront,
  Storefront,
  waitFor,
} from "../helpers/checkout"

jest.setTimeout(20 * 60 * 1000)

/**
 * Phase 3 step 4 and 6: the ONE completion endpoint records every kind of item
 * (rentals with their deposit, expressions of interest, digital products), and
 * those records keep working for the seller when the order is split.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("complete-all: rentals, expressions of interest, digital, and seller orders", () => {
      let storefront: Storefront
      let sellerA: TestVendor
      let sellerB: TestVendor
      let a: Awaited<ReturnType<typeof setUpSeller>>
      let b: Awaited<ReturnType<typeof setUpSeller>>
      let rentalVariant: string
      let eoiVariant: string
      let digitalVariant: string
      let allKindsOrder: string
      let mixedOrder: string

      const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY) as any
      const marketplace = () => getContainer().resolve(MARKETPLACE_MODULE) as any

      const vendorOrders = async (vendorId: string) =>
        ((await query().graph({ entity: "vendor", fields: ["id", "orders.id"], filters: { id: [vendorId] } })).data[0]?.orders ?? []).map((o: any) => o.id) as string[]

      const rentalItem = (variantId: string, start: string, end: string): CartItem => ({
        path: "line-items/rentals",
        body: { variant_id: variantId, quantity: 1, metadata: { rental_start_date: start, rental_end_date: end, rental_days: 2 } },
      })

      beforeAll(async () => {
        const container = getContainer()
        storefront = await setUpStorefront(container)

        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        a = await setUpSeller(api, container, sellerA, "a", 100)
        b = await setUpSeller(api, container, sellerB, "b", 50)

        // --- a rentable product (seller sets the terms through their own route)
        const rental = await createSellerProduct(api, sellerA, a.profile, "A rental", 40)
        rentalVariant = rental.variants[0].id
        await must(
          "rental config",
          api.post(`/vendors/products/${rental.id}/rental-config`, { status: "active", min_rental_days: 1, rental_unit: "day", security_deposit_amount: 25, security_deposit_type: "fixed" }, sellerA.headers)
        )

        // --- an expression-of-interest product (the config route is admin-side)
        const eoi = await createSellerProduct(api, sellerA, a.profile, "A eoi", 300)
        eoiVariant = eoi.variants[0].id
        const userModule = container.resolve(Modules.USER) as any
        const authModule = container.resolve(Modules.AUTH) as any
        await api.post("/auth/user/emailpass/register", { email: "admin@features.test", password: "supersecret-Test-1" })
        const user = await userModule.createUsers({ email: "admin@features.test" })
        const identity = (await authModule.listAuthIdentities({ provider_identities: { entity_id: "admin@features.test" } }))[0]
        await authModule.updateAuthIdentities({ id: identity.id, app_metadata: { user_id: user.id } })
        const login: any = await api.post("/auth/user/emailpass", { email: "admin@features.test", password: "supersecret-Test-1" })
        await must(
          "eoi config",
          api.post(`/admin/products/${eoi.id}/eoi-config`, { status: "active", value_type: "percentage", value_amount: 10 }, { headers: { authorization: `Bearer ${login.data.token}` } })
        )

        // --- a digital product, made the way the platform makes them, then given to seller A
        await createDigitalProductWorkflow(container).run({
          input: {
            digital_product: { name: "A ebook", medias: [{ type: "main", fileId: "file_ebook", mimeType: "application/pdf" }] },
            product: {
              title: "A ebook",
              status: "published",
              shipping_profile_id: a.profile,
              options: [{ title: "Format", values: ["PDF"] }],
              variants: [{ title: "PDF", options: { Format: "PDF" }, prices: [{ currency_code: "usd", amount: 20 }], manage_inventory: false }],
              sales_channels: [{ id: storefront.channelId }],
            },
          } as any,
        })
        // The workflow returns only the digital product record; find its product by title.
        const digitalProductId = (
          await query().graph({ entity: "product", fields: ["id"], filters: { title: "A ebook" } })
        ).data[0].id
        await (container.resolve(ContainerRegistrationKeys.LINK) as any).create({
          [MARKETPLACE_MODULE]: { vendor_id: sellerA.vendorId },
          [Modules.PRODUCT]: { product_id: digitalProductId },
        })
        digitalVariant = (
          await query().graph({ entity: "product_variant", fields: ["id"], filters: { product_id: digitalProductId } })
        ).data[0].id

        // --- cart 1: every kind of item, all seller A's
        allKindsOrder = await completeCart(
          api,
          storefront,
          [
            { body: { variant_id: a.variantId, quantity: 1 } },
            rentalItem(rentalVariant, "2031-03-01T00:00:00.000Z", "2031-03-03T00:00:00.000Z"),
            { path: "line-items/eoi", body: { variant_id: eoiVariant, quantity: 1 } },
            { body: { variant_id: digitalVariant, quantity: 1 } },
          ],
          [a.option]
        )

        // --- cart 2: seller A's rental next to seller B's product
        mixedOrder = await completeCart(
          api,
          storefront,
          [
            rentalItem(rentalVariant, "2031-04-01T00:00:00.000Z", "2031-04-03T00:00:00.000Z"),
            { body: { variant_id: b.variantId, quantity: 1 } },
          ],
          [a.option, b.option]
        )
        await waitFor(
          async () => marketplace().listVendorOrderSplits({ parent_order_id: mixedOrder }),
          (rows: any[]) => rows.length >= 2
        )
      })

      it("one endpoint records the rental, the expression of interest and the digital order", async () => {
        const { data: rentals } = await query().graph({ entity: "rental", fields: ["id", "status", "order_id", "variant_id"], filters: { order_id: allKindsOrder } })
        expect(rentals).toHaveLength(1)
        expect(rentals[0].variant_id).toBe(rentalVariant)
        expect(rentals[0].status).toBe("pending")

        const { data: eois } = await query().graph({ entity: "eoi", fields: ["id", "order_id"], filters: { order_id: allKindsOrder } })
        expect(eois).toHaveLength(1)

        const { data: orders } = await query().graph({
          entity: "order",
          fields: ["id", "digital_product_order.id"],
          filters: { id: allKindsOrder },
        })
        expect(orders[0].digital_product_order?.id).toBeTruthy()
      })

      it("a one-seller order with a rental is NOT split: the deposit stays with the seller", async () => {
        expect(await vendorOrders(sellerA.vendorId)).toContain(allKindsOrder)
        expect(await marketplace().listVendorOrderSplits({ parent_order_id: allKindsOrder })).toHaveLength(0)
        expect((await call(api.get(`/vendors/orders/${allKindsOrder}`, sellerA.headers))).status).toBe(200)
      })

      it("completing twice does not book twice", async () => {
        const { completeCartMarketplaceWorkflow } = await import("../../../src/workflows/complete-cart-marketplace")
        const { data: carts } = await query().graph({ entity: "cart", fields: ["id"], filters: { completed_at: { $ne: null } } })
        expect(carts.length).toBeGreaterThan(0)
        for (const cart of carts) {
          await completeCartMarketplaceWorkflow(getContainer()).run({ input: { cart_id: cart.id } }).catch(() => undefined)
        }
        const { data: rentals } = await query().graph({ entity: "rental", fields: ["id"], filters: { order_id: allKindsOrder } })
        expect(rentals).toHaveLength(1)
        const { data: eois } = await query().graph({ entity: "eoi", fields: ["id"], filters: { order_id: allKindsOrder } })
        expect(eois).toHaveLength(1)
      })

      it("a mixed cart splits; the seller's child holds the rental AND its deposit, the other seller's holds neither", async () => {
        const splits: any[] = await marketplace().listVendorOrderSplits({ parent_order_id: mixedOrder })
        expect(splits).toHaveLength(2)

        const childOf = async (vendorId: string) => {
          const row = splits.find((s) => s.vendor_id === vendorId)
          return (
            await query().graph({
              entity: "order",
              fields: ["id", "items.id", "items.title", "items.product_id", "items.metadata"],
              filters: { id: row.child_order_id },
            })
          ).data[0]
        }

        const childA = await childOf(sellerA.vendorId)
        expect(childA.items.some((i: any) => i.metadata?.rental_start_date)).toBe(true)
        expect(childA.items.some((i: any) => i.metadata?.is_rental_deposit)).toBe(true)

        const childB = await childOf(sellerB.vendorId)
        expect(childB.items.some((i: any) => i.metadata?.is_rental_deposit || i.metadata?.rental_start_date)).toBe(false)
      })

      it("the seller finds the rental from their child order, and the other seller does not", async () => {
        const splits: any[] = await marketplace().listVendorOrderSplits({ parent_order_id: mixedOrder })
        const childA = splits.find((s) => s.vendor_id === sellerA.vendorId).child_order_id
        const childB = splits.find((s) => s.vendor_id === sellerB.vendorId).child_order_id

        const mine = await call(api.get(`/vendors/orders/${childA}/rentals`, sellerA.headers))
        expect(mine.status).toBe(200)
        expect(mine.data.rentals).toHaveLength(1)

        const theirs = await call(api.get(`/vendors/orders/${childB}/rentals`, sellerB.headers))
        expect(theirs.data.rentals).toEqual([])
        expect((await call(api.get(`/vendors/orders/${childA}/rentals`, sellerB.headers))).status).toBe(404)
      })

      it("shipping the seller's order activates the rental, which was booked on the parent", async () => {
        const splits: any[] = await marketplace().listVendorOrderSplits({ parent_order_id: mixedOrder })
        const childA = splits.find((s) => s.vendor_id === sellerA.vendorId).child_order_id

        const { data: orders } = await query().graph({
          entity: "order",
          fields: ["id", "items.id", "items.metadata", "items.quantity", "items.detail.quantity"],
          filters: { id: childA },
        })
        const rentalLine = orders[0].items.find((i: any) => i.metadata?.rental_start_date)
        expect(rentalLine).toBeDefined()

        const { result: fulfillment } = await createOrderFulfillmentWorkflow(getContainer()).run({
          input: {
            order_id: childA,
            location_id: a.location,
            items: [{ id: rentalLine.id, quantity: 1 }],
          },
        } as any)
        await createOrderShipmentWorkflow(getContainer()).run({
          input: {
            order_id: childA,
            fulfillment_id: (fulfillment as any).id,
            items: [{ id: rentalLine.id, quantity: 1 }],
            labels: [],
          },
        } as any)

        const rentals = await waitFor(
          async () => (await query().graph({ entity: "rental", fields: ["id", "status"], filters: { order_id: mixedOrder } })).data,
          (rows: any[]) => rows.length > 0 && rows[0].status === "active"
        )
        expect(rentals[0].status).toBe("active")
      })

      it("cancelling the seller's order cancels the rental booked on the parent", async () => {
        const splits: any[] = await marketplace().listVendorOrderSplits({ parent_order_id: mixedOrder })
        const childA = splits.find((s) => s.vendor_id === sellerA.vendorId).child_order_id

        await cancelOrderWorkflow(getContainer()).run({ input: { order_id: childA } })

        const rentals = await waitFor(
          async () => (await query().graph({ entity: "rental", fields: ["id", "status"], filters: { order_id: mixedOrder } })).data,
          (rows: any[]) => rows.length > 0 && rows[0].status === "cancelled"
        )
        expect(rentals[0].status).toBe("cancelled")

        const [entry] = await marketplace().listVendorOrderSplits({ child_order_id: childA })
        expect(entry.payout_status).toBe("void")
      })
    })
  },
})
