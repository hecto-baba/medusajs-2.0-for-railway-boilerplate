import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import {
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
 * Phase 3 step 4 and 6: tickets and appointments, completed through the ONE
 * endpoint in a cart that also holds another seller's product, so the order is
 * split. The bookings are recorded against the parent order (the buyer's), and
 * the seller's own order carries the items.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("complete-all: tickets and appointments in a split order", () => {
      let storefront: Storefront
      let sellerA: TestVendor
      let sellerB: TestVendor
      let orderId: string

      const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY) as any
      const marketplace = () => getContainer().resolve(MARKETPLACE_MODULE) as any

      beforeAll(async () => {
        const container = getContainer()
        storefront = await setUpStorefront(container)

        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        const a = await setUpSeller(api, container, sellerA, "a", 100)
        const b = await setUpSeller(api, container, sellerB, "b", 50)

        // --- tickets: a venue with one row, a show on one future date
        const showDate = "2031-06-15T19:00:00.000Z"
        const venue = (
          await must(
            "venue",
            api.post("/vendors/venues", { name: "A hall", address: "1 Main St", rows: [{ row_number: "A", row_type: "vip", seat_count: 5 }] }, sellerA.headers)
          )
        ).data.venue
        await must(
          "show",
          api.post(
            "/vendors/shows",
            { name: "A concert", venue_id: venue.id, dates: [showDate], variants: [{ row_type: "vip", seat_count: 5, prices: [{ currency_code: "usd", amount: 80 }] }] },
            sellerA.headers
          )
        )
        const { data: ticketProducts } = await query().graph({
          entity: "ticket_product",
          fields: ["id", "venue_id", "product.variants.id"],
          filters: { venue_id: venue.id },
        })
        const ticketVariant = ticketProducts[0].product.variants[0].id as string
        const { data: rows } = await query().graph({ entity: "venue_row", fields: ["id", "row_number", "row_type"], filters: { venue_id: venue.id } })
        const row = rows[0]

        // --- appointments: a provider, a service product, one bookable slot
        await must("provider", api.post("/vendors/providers/me", { timezone: "UTC", display_name: "A staff" }, sellerA.headers))
        // Slots are cut from the provider's weekly availability: Tuesdays 09:00-12:00.
        await must(
          "availability",
          api.post(
            "/vendors/providers/me/recurring-availability",
            { day_of_week: 2, start_time: "09:00", end_time: "12:00", effective_from: "2031-01-01T00:00:00.000Z" },
            sellerA.headers
          )
        )
        const service = await createSellerProduct(api, sellerA, a.profile, "A haircut", 30)
        const slots = await must(
          "slots",
          api.post(
            "/vendors/providers/me/slots",
            {
              service_product_id: service.id,
              service_variant_id: service.variants[0].id,
              service_duration_minutes: 30,
              max_capacity: 1,
              date_from: "2031-07-01T09:00:00.000Z",
              date_to: "2031-07-01T10:00:00.000Z",
            },
            sellerA.headers
          )
        )
        const appointmentId = slots.data.appointments[0].id as string

        orderId = await completeCart(
          api,
          storefront,
          [
            {
              path: "line-items/tickets",
              body: {
                items: [
                  {
                    variant_id: ticketVariant,
                    metadata: { seat_number: "1", row_number: row.row_number, venue_row_id: row.id, show_date: showDate, row_type: "vip" },
                  },
                ],
              },
            },
            { path: "line-items/appointments", body: { appointment_id: appointmentId, variant_id: service.variants[0].id } },
            { body: { variant_id: b.variantId, quantity: 1 } },
          ],
          [a.option, b.option]
        )
        await waitFor(
          async () => marketplace().listVendorOrderSplits({ parent_order_id: orderId }),
          (rows2: any[]) => rows2.length >= 2
        )
      })

      it("records the ticket purchase and the appointment attendee on the order", async () => {
        const { data: orders } = await query().graph({
          entity: "order",
          fields: ["id", "ticket_purchases.id", "ticket_purchases.seat_number"],
          filters: { id: orderId },
        })
        expect(orders[0].ticket_purchases).toHaveLength(1)
        expect(orders[0].ticket_purchases[0].seat_number).toBe("1")
        // The attendee is exposed on the order through the link alias "attendee_order".
        const { data: withAttendees } = await query().graph({
          entity: "order",
          fields: ["id", "attendee_order.id"],
          filters: { id: orderId },
        })
        expect([withAttendees[0].attendee_order].flat().filter(Boolean)).toHaveLength(1)
      })

      it("splits the order: seller A's order carries the ticket and the appointment, seller B's only their product", async () => {
        const splits: any[] = await marketplace().listVendorOrderSplits({ parent_order_id: orderId })
        expect(splits).toHaveLength(2)

        const itemsOf = async (vendorId: string) => {
          const row = splits.find((s) => s.vendor_id === vendorId)
          const { data } = await query().graph({
            entity: "order",
            fields: ["id", "items.metadata"],
            filters: { id: row.child_order_id },
          })
          return data[0].items as any[]
        }

        const itemsA = await itemsOf(sellerA.vendorId)
        expect(itemsA).toHaveLength(2)
        expect(itemsA.some((i) => i.metadata?.seat_number)).toBe(true)
        expect(itemsA.some((i) => i.metadata?.appointment_id)).toBe(true)

        const itemsB = await itemsOf(sellerB.vendorId)
        expect(itemsB).toHaveLength(1)
        expect(itemsB[0].metadata?.seat_number).toBeUndefined()
      })

      it("exactly one ticket purchase exists, and the seller cannot open the buyer's parent order", async () => {
        const { data: purchases } = await query().graph({ entity: "ticket_purchase", fields: ["id"] })
        expect(purchases).toHaveLength(1)

        const parent = (await call(api.get(`/vendors/orders/${orderId}`, sellerA.headers))).status
        expect(parent).toBe(404)
      })
    })
  },
})
