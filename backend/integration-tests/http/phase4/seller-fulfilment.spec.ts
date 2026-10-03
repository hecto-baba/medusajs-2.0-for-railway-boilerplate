import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow, createOrdersWorkflow } from "@medusajs/medusa/core-flows"
import { sendBuyerFulfillmentEmail } from "../../../src/lib/buyer-fulfillment-email"
import { resolveFulfillmentLocation } from "../../../src/lib/fulfillment-location"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import {
  completeCart,
  createStockedProduct,
  must,
  setUpSeller,
  setUpStorefront,
  Storefront,
  waitFor,
} from "../helpers/checkout"

jest.setTimeout(25 * 60 * 1000)

/**
 * Phase 4 of docs/tenant-isolation-and-multi-tenancy.md: a seller fulfils, ships,
 * delivers, cancels, refunds and returns THEIR OWN order, and nobody else's.
 *
 * Fixture: sellers A and B each sell a stocked product (10 units at their own
 * location). One cart holds 2 of A's and 1 of B's, so the order splits into a
 * child per seller; the buyer's payment is captured on the parent.
 *
 * Reminder: the test database rolls back after every test, so each test that
 * changes something runs its own whole sequence.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller fulfilment, cancel, refund and return", () => {
      let storefront: Storefront
      let sellerA: TestVendor
      let sellerB: TestVendor
      let a: Awaited<ReturnType<typeof setUpSeller>>
      let b: Awaited<ReturnType<typeof setUpSeller>>
      let stockA: Awaited<ReturnType<typeof createStockedProduct>>
      let stockB: Awaited<ReturnType<typeof createStockedProduct>>
      let parentId: string
      let childA: string
      let childB: string
      let lineA: string
      let lineB: string

      const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY) as any
      const marketplace = () => getContainer().resolve(MARKETPLACE_MODULE) as any
      const inventory = () => getContainer().resolve(Modules.INVENTORY) as any

      const levelOf = async (inventoryItemId: string, locationId: string) => {
        const [level] = await inventory().listInventoryLevels({ inventory_item_id: inventoryItemId, location_id: locationId })
        return { stocked: Number(level.stocked_quantity), reserved: Number(level.reserved_quantity) }
      }

      const reservationsFor = async (lineItemId: string) =>
        (await inventory().listReservationItems({ line_item_id: lineItemId })) as any[]

      const fulfil = (seller: TestVendor, orderId: string, lineId: string, optionId: string, quantity = 2, extra: Record<string, unknown> = {}) =>
        call(
          api.post(`/vendors/orders/${orderId}/fulfillments`, { items: [{ id: lineId, quantity }], shipping_option_id: optionId, ...extra }, seller.headers)
        )

      beforeAll(async () => {
        const container = getContainer()
        storefront = await setUpStorefront(container)
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        a = await setUpSeller(api, container, sellerA, "a", 100)
        b = await setUpSeller(api, container, sellerB, "b", 50)
        stockA = await createStockedProduct(api, container, sellerA, a.profile, a.location, "A stocked", 100, 10)
        stockB = await createStockedProduct(api, container, sellerB, b.profile, b.location, "B stocked", 50, 10)

        parentId = await completeCart(
          api,
          storefront,
          [
            { body: { variant_id: stockA.variantId, quantity: 2 } },
            { body: { variant_id: stockB.variantId, quantity: 1 } },
          ],
          [a.option, b.option]
        )
        const splits = await waitFor(
          async () => marketplace().listVendorOrderSplits({ parent_order_id: parentId }),
          (rows: any[]) => rows.length >= 2
        )
        childA = splits.find((s: any) => s.vendor_id === sellerA.vendorId).child_order_id
        childB = splits.find((s: any) => s.vendor_id === sellerB.vendorId).child_order_id

        const lineOf = async (orderId: string) =>
          (await query().graph({ entity: "order", fields: ["id", "items.id"], filters: { id: orderId } })).data[0].items[0].id as string
        lineA = await lineOf(childA)
        lineB = await lineOf(childB)

        // The buyer's payment, captured on the parent, so refunds can be tested.
        const { data: parents } = await query().graph({
          entity: "order",
          fields: ["id", "payment_collections.payments.id"],
          filters: { id: parentId },
        })
        const paymentId = parents[0].payment_collections[0].payments[0].id
        await capturePaymentWorkflow(container).run({ input: { payment_id: paymentId, captured_by: "test" } })
      })

      // ---------------------------------------------------------------- step 3
      it("stock reserved at checkout is moved to the seller's order, at the seller's own location", async () => {
        const reservations = await reservationsFor(lineA)
        expect(reservations).toHaveLength(1)
        expect(reservations[0].location_id).toBe(a.location)
        expect(Number(reservations[0].quantity)).toBe(2)

        const parentLines = (await query().graph({ entity: "order", fields: ["id", "items.id"], filters: { id: parentId } })).data[0].items as any[]
        for (const line of parentLines) {
          expect(await reservationsFor(line.id)).toHaveLength(0)
        }
        expect(await levelOf(stockA.inventoryItemId, a.location)).toEqual({ stocked: 10, reserved: 2 })
        expect(await levelOf(stockB.inventoryItemId, b.location)).toEqual({ stocked: 10, reserved: 1 })
      })

      // ---------------------------------------------------------------- step 1
      it("a seller fulfils, ships with tracking and delivers their own order, and the stock goes down", async () => {
        const made = await fulfil(sellerA, childA, lineA, a.option, 2, { location_id: a.location })
        expect(made.status).toBe(201)
        const fulfillmentId = made.data.fulfillment.id

        // Stock is taken from the seller's location: on hand 10 -> 8, nothing left reserved.
        expect(await levelOf(stockA.inventoryItemId, a.location)).toEqual({ stocked: 8, reserved: 0 })

        const shipped = await call(
          api.post(
            `/vendors/orders/${childA}/fulfillments/${fulfillmentId}/shipments`,
            { labels: [{ tracking_number: "TRK-123", tracking_url: "https://track.example/TRK-123" }] },
            sellerA.headers
          )
        )
        expect(shipped.status).toBe(201)

        const { data: afterShip } = await query().graph({
          entity: "fulfillment",
          fields: ["id", "shipped_at", "delivered_at", "labels.tracking_number"],
          filters: { id: fulfillmentId },
        })
        expect(afterShip[0].shipped_at).toBeTruthy()
        expect(afterShip[0].labels.map((l: any) => l.tracking_number)).toEqual(["TRK-123"])

        const delivered = await call(api.post(`/vendors/orders/${childA}/fulfillments/${fulfillmentId}/mark-as-delivered`, {}, sellerA.headers))
        expect(delivered.status).toBe(200)
        const { data: afterDelivery } = await query().graph({ entity: "fulfillment", fields: ["id", "delivered_at"], filters: { id: fulfillmentId } })
        expect(afterDelivery[0].delivered_at).toBeTruthy()

        // The other seller's stock and order are untouched.
        expect(await levelOf(stockB.inventoryItemId, b.location)).toEqual({ stocked: 10, reserved: 1 })
      })

      it("cancelling a fulfilment puts the stock back", async () => {
        const made = await fulfil(sellerA, childA, lineA, a.option)
        expect(made.status).toBe(201)
        expect(await levelOf(stockA.inventoryItemId, a.location)).toEqual({ stocked: 8, reserved: 0 })

        const canceled = await call(api.post(`/vendors/orders/${childA}/fulfillments/${made.data.fulfillment.id}/cancel`, {}, sellerA.headers))
        expect(canceled.status).toBe(200)
        expect((await levelOf(stockA.inventoryItemId, a.location)).stocked).toBe(10)
      })

      it("the shipping option must be named, and must be the seller's own and one the buyer chose", async () => {
        const missing = await call(api.post(`/vendors/orders/${childA}/fulfillments`, { items: [{ id: lineA, quantity: 2 }] }, sellerA.headers))
        expect(missing.status).toBe(400)

        // Seller B's option, even though it is a real option.
        expect((await fulfil(sellerA, childA, lineA, b.option)).status).toBe(404)
        // The seller's own option that this order's buyer did not choose: a second option of A's.
        const other = await must(
          "second option",
          api.post(
            "/vendors/shipping-options",
            {
              name: "a express",
              service_zone_id: (await query().graph({ entity: "stock_location", fields: ["fulfillment_sets.service_zones.id"], filters: { id: a.location } })).data[0].fulfillment_sets[0].service_zones[0].id,
              shipping_profile_id: a.profile,
              shipping_option_type_id: (await call(api.get("/vendors/shipping-option-types", sellerA.headers))).data.shipping_option_types[0].id,
              prices: [{ currency_code: "usd", amount: 30 }],
            },
            sellerA.headers
          )
        )
        expect((await fulfil(sellerA, childA, lineA, other.data.shipping_option.id)).status).toBe(404)
      })

      it("a seller cannot use another seller's location, order, items or fulfilment", async () => {
        // B's location on A's order.
        expect((await fulfil(sellerA, childA, lineA, a.option, 2, { location_id: b.location })).status).toBe(404)
        // B on A's order, at every action.
        expect((await fulfil(sellerB, childA, lineA, b.option)).status).toBe(404)
        expect((await call(api.post(`/vendors/orders/${childA}/cancel`, {}, sellerB.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/orders/${childA}/refunds`, { amount: 1 }, sellerB.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/orders/${childA}/returns`, { items: [{ id: lineA, quantity: 1 }] }, sellerB.headers))).status).toBe(404)
        // The buyer's parent order: nobody's.
        expect((await fulfil(sellerA, parentId, lineA, a.option)).status).toBe(404)
        expect((await call(api.post(`/vendors/orders/${parentId}/cancel`, {}, sellerA.headers))).status).toBe(404)
        // An item of ANOTHER order named on my own order.
        expect((await fulfil(sellerA, childA, lineB, a.option)).status).toBe(404)

        // A fulfilment of A's order cannot be driven through B's order id (or the reverse).
        const made = await fulfil(sellerA, childA, lineA, a.option)
        const fulfillmentId = made.data.fulfillment.id
        expect((await call(api.post(`/vendors/orders/${childA}/fulfillments/${fulfillmentId}/shipments`, {}, sellerB.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/orders/${childB}/fulfillments/${fulfillmentId}/shipments`, {}, sellerB.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/orders/${childB}/fulfillments/${fulfillmentId}/cancel`, {}, sellerB.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/orders/${childB}/fulfillments/${fulfillmentId}/mark-as-delivered`, {}, sellerB.headers))).status).toBe(404)
      })

      // ---------------------------------------------------------------- step 2
      it("a seller cancels their own order only: the stock is released, the entry is void, the others stay", async () => {
        const res = await call(api.post(`/vendors/orders/${childA}/cancel`, {}, sellerA.headers))
        expect(res.status).toBe(200)

        const { data: orders } = await query().graph({ entity: "order", fields: ["id", "status"], filters: { id: [childA, childB, parentId] } })
        const status = Object.fromEntries(orders.map((o: any) => [o.id, o.status]))
        expect(status[childA]).toBe("canceled")
        expect(status[childB]).not.toBe("canceled")
        expect(status[parentId]).not.toBe("canceled")

        const entry = await waitFor(
          async () => (await marketplace().listVendorOrderSplits({ child_order_id: childA }))[0],
          (row: any) => row.payout_status === "void"
        )
        expect(entry.payout_status).toBe("void")
        expect(await reservationsFor(lineA)).toHaveLength(0)
        expect((await levelOf(stockA.inventoryItemId, a.location)).reserved).toBe(0)
      })

      it("a seller refunds the buyer up to their own share, through the buyer's single payment", async () => {
        const [entry] = await marketplace().listVendorOrderSplits({ child_order_id: childA })
        expect(Number(entry.total)).toBe(231) // 2 x 100 + 10 shipping, plus 10% tax

        const refund = await call(api.post(`/vendors/orders/${childA}/refunds`, { amount: 50, note: "damaged" }, sellerA.headers))
        expect(refund.status).toBe(201)

        const [after] = await marketplace().listVendorOrderSplits({ child_order_id: childA })
        expect(Number(after.refunded_total)).toBe(50)

        const { data: parents } = await query().graph({
          entity: "order",
          fields: ["id", "payment_collections.payments.refunds.amount"],
          filters: { id: parentId },
        })
        const refunded = parents[0].payment_collections[0].payments[0].refunds.reduce((sum: number, r: any) => sum + Number(r.amount), 0)
        expect(refunded).toBe(50)

        // More than is left of THIS seller's share.
        const tooMuch = await call(api.post(`/vendors/orders/${childA}/refunds`, { amount: 200 }, sellerA.headers))
        expect(tooMuch.status).toBe(400)
        // Not even if the buyer's payment could cover it: the other seller's share is not theirs.
        const mine = await call(api.get("/vendors/payouts", sellerA.headers))
        expect(mine.data.totals.usd.refunded).toBe(50)
        const theirs = await call(api.get("/vendors/payouts", sellerB.headers))
        expect(theirs.data.totals.usd.refunded).toBe(0)
      })

      it("a seller records a return of their own items, received back at their own location", async () => {
        const made = await fulfil(sellerA, childA, lineA, a.option)
        await call(api.post(`/vendors/orders/${childA}/fulfillments/${made.data.fulfillment.id}/shipments`, {}, sellerA.headers))
        expect((await levelOf(stockA.inventoryItemId, a.location)).stocked).toBe(8)

        const ret = await call(
          api.post(`/vendors/orders/${childA}/returns`, { items: [{ id: lineA, quantity: 1 }], receive_now: true, location_id: a.location }, sellerA.headers)
        )
        expect({ status: ret.status, body: ret.data }).toEqual(expect.objectContaining({ status: 201 }))
        expect((await levelOf(stockA.inventoryItemId, a.location)).stocked).toBe(9)

        // B's location, or an unknown item, is refused.
        expect((await call(api.post(`/vendors/orders/${childA}/returns`, { items: [{ id: lineA, quantity: 1 }], receive_now: true, location_id: b.location }, sellerA.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/orders/${childA}/returns`, { items: [{ id: lineB, quantity: 1 }] }, sellerA.headers))).status).toBe(404)
      })

      it("an older shared order cannot be cancelled, refunded or returned by one of its sellers, and only their own items can be fulfilled", async () => {
        // A legacy order: items of both sellers, linked to seller A only.
        const { result: legacy } = await createOrdersWorkflow(getContainer()).run({
          input: {
            currency_code: "usd",
            region_id: storefront.regionId,
            sales_channel_id: storefront.channelId,
            email: "legacy@test.local",
            status: "pending",
            items: [
              { title: "A item", quantity: 1, unit_price: 10, product_id: stockA.productId, variant_id: stockA.variantId },
              { title: "B item", quantity: 1, unit_price: 10, product_id: stockB.productId, variant_id: stockB.variantId },
            ],
          } as any,
        })
        const legacyId = (legacy as any).id
        await (getContainer().resolve(ContainerRegistrationKeys.LINK) as any).create({
          [MARKETPLACE_MODULE]: { vendor_id: sellerA.vendorId },
          [Modules.ORDER]: { order_id: legacyId },
        })

        expect((await call(api.post(`/vendors/orders/${legacyId}/cancel`, {}, sellerA.headers))).status).toBe(400)
        expect((await call(api.post(`/vendors/orders/${legacyId}/refunds`, { amount: 1 }, sellerA.headers))).status).toBe(400)
        expect((await call(api.post(`/vendors/orders/${legacyId}/returns`, { items: [{ id: "x", quantity: 1 }] }, sellerA.headers))).status).toBe(400)

        const lines = (await query().graph({ entity: "order", fields: ["id", "items.id", "items.title"], filters: { id: legacyId } })).data[0].items as any[]
        const bLine = lines.find((l) => l.title === "B item").id
        expect((await fulfil(sellerA, legacyId, bLine, a.option, 1)).status).toBe(404)
      })

      // ---------------------------------------------------------------- step 5
      it("a delivery is fulfilled from the seller's real location, never a hard-coded one", async () => {
        expect(await resolveFulfillmentLocation(getContainer(), childA)).toBe(a.location)
        expect(await resolveFulfillmentLocation(getContainer(), childB)).toBe(b.location)

        // No shipping method and no seller: nothing to fulfil from, so a clear error.
        const { result: orphan } = await createOrdersWorkflow(getContainer()).run({
          input: {
            currency_code: "usd",
            region_id: storefront.regionId,
            email: "x@test.local",
            status: "pending",
            items: [{ title: "Loose item", quantity: 1, unit_price: 5 }],
          } as any,
        })
        await expect(resolveFulfillmentLocation(getContainer(), (orphan as any).id)).rejects.toThrow(/Cannot choose a stock location/)
      })

      // ---------------------------------------------------------------- step 7
      it("the buyer is emailed when a seller ships and when it is delivered, naming the seller and the order they know", async () => {
        const made = await fulfil(sellerA, childA, lineA, a.option)
        const fulfillmentId = made.data.fulfillment.id
        await call(
          api.post(
            `/vendors/orders/${childA}/fulfillments/${fulfillmentId}/shipments`,
            { labels: [{ tracking_number: "TRK-9", tracking_url: "https://track.example/TRK-9" }], no_notification: true },
            sellerA.headers
          )
        )

        const sent: any[] = []
        const real = getContainer()
        const container: any = {
          resolve: (key: string) =>
            key === Modules.NOTIFICATION ? { createNotifications: async (n: any) => sent.push(n) } : real.resolve(key),
        }

        const { data: parents } = await query().graph({ entity: "order", fields: ["id", "display_id"], filters: { id: parentId } })
        const sellerName = (await query().graph({ entity: "vendor", fields: ["id", "name"], filters: { id: [sellerA.vendorId] } })).data[0].name

        const shipped = await sendBuyerFulfillmentEmail(container, { fulfillment_id: fulfillmentId, kind: "shipped" })
        expect(shipped.sent).toBe(true)
        expect(sent[0]).toEqual(
          expect.objectContaining({ to: "buyer@test.local", channel: "email", template: "fulfillment-update" })
        )
        expect(sent[0].data).toEqual(
          expect.objectContaining({
            kind: "shipped",
            orderDisplayId: parents[0].display_id,
            sellerName,
            trackingNumber: "TRK-9",
            trackingUrl: "https://track.example/TRK-9",
          })
        )
        expect(sent[0].data.items).toEqual([expect.objectContaining({ quantity: 2 })])

        const delivered = await sendBuyerFulfillmentEmail(container, { fulfillment_id: fulfillmentId, kind: "delivered" })
        expect(delivered.sent).toBe(true)
        expect(sent[1].data.kind).toBe("delivered")

        // The seller chose not to notify.
        const quiet = await sendBuyerFulfillmentEmail(container, { fulfillment_id: fulfillmentId, kind: "shipped", no_notification: true })
        expect(quiet).toEqual({ sent: false, reason: "no_notification" })
        expect(sent).toHaveLength(2)
      })
    })
  },
})
