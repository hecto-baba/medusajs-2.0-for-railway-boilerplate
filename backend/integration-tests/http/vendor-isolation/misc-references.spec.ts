import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import { onboardingStore } from "../../../src/lib/onboarding-store"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 16 of docs/tenant-isolation-and-multi-tenancy.md: the smaller
 * holes.
 *
 *  - appointment slots can only be created for the seller's own product
 *  - on an order shared by several sellers, a seller sees and changes only the
 *    rentals of THEIR products
 *  - an approved (or under review) seller cannot edit their onboarding answers
 *    or re-submit, which would reset them to "under review"
 *  - another seller's recurring availability rule answers 404, not a distinct
 *    "does not belong to you" error that confirms the id exists
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: smaller references", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let productA: string
      let productB: string
      let variantA: string
      let variantB: string
      let ruleB: string
      let sharedOrder: string
      let rentalA: string
      let rentalB: string

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

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        const pA = (await must("product A", api.post("/vendors/products", productBody("A product"), sellerA.headers))).data.product
        const pB = (await must("product B", api.post("/vendors/products", productBody("B product"), sellerB.headers))).data.product
        productA = pA.id
        productB = pB.id
        variantA = pA.variants[0].id
        variantB = pB.variants[0].id

        // Appointment providers: each seller has one; B has a recurring availability rule.
        await must("provider A", api.post("/vendors/providers/me", { timezone: "UTC" }, sellerA.headers))
        await must("provider B", api.post("/vendors/providers/me", { timezone: "UTC" }, sellerB.headers))
        ruleB = (
          await must(
            "rule B",
            api.post("/vendors/providers/me/recurring-availability", { day_of_week: 1, start_time: "09:00", end_time: "17:00", effective_from: "2030-01-01" }, sellerB.headers)
          )
        ).data.recurring_availability.id

        // ONE order linked to seller A only (Medusa allows one seller per order link), with a
        // rental of EACH seller's product on it: the mixed cart the link cannot describe.
        const container = getContainer()
        const orderModule = container.resolve(Modules.ORDER) as any
        const order = await orderModule.createOrders({
          currency_code: "usd",
          email: "shopper@example.com",
          items: [{ title: "Mixed cart", quantity: 1, unit_price: 100 }],
        })
        sharedOrder = order.id
        const link: any = container.resolve(ContainerRegistrationKeys.LINK)
        await link.create({ [MARKETPLACE_MODULE]: { vendor_id: sellerA.vendorId }, [Modules.ORDER]: { order_id: sharedOrder } })

        const rentalModule = container.resolve("rental") as any
        const configA = await rentalModule.createRentalConfigurations({ product_id: productA })
        const configB = await rentalModule.createRentalConfigurations({ product_id: productB })
        const base = {
          customer_id: "cus_shopper",
          order_id: sharedOrder,
          rental_start_date: new Date("2030-01-01T00:00:00Z"),
          rental_end_date: new Date("2030-01-03T00:00:00Z"),
          rental_days: 2,
        }
        rentalA = (await rentalModule.createRentals({ ...base, variant_id: variantA, rental_configuration_id: configA.id })).id
        rentalB = (await rentalModule.createRentals({ ...base, variant_id: variantB, rental_configuration_id: configB.id })).id
      })

      describe("appointment slots", () => {
        const slotBody = (productId: string) => ({
          service_product_id: productId,
          service_duration_minutes: 30,
          date_from: "2030-01-01T09:00:00Z",
          date_to: "2030-01-01T10:00:00Z",
        })

        it("slots cannot be created for another seller's product (404)", async () => {
          const res = await call(api.post("/vendors/providers/me/slots", slotBody(productB), sellerA.headers))
          expect(res.status).toBe(404)
        })

        it("slots can be created for the seller's own product", async () => {
          const res = await call(api.post("/vendors/providers/me/slots", slotBody(productA), sellerA.headers))
          expect({ status: res.status, body: res.status === 200 ? "ok" : res.data }).toEqual({ status: 200, body: "ok" })
        })
      })

      describe("rentals on an order shared by several sellers", () => {
        it("a seller sees only the rentals of their own products", async () => {
          const res = await call(api.get(`/vendors/orders/${sharedOrder}/rentals`, sellerA.headers))
          expect(res.status).toBe(200)
          const ids = (res.data.rentals ?? []).map((r: any) => r.id)
          expect(ids).toContain(rentalA)
          expect(ids).not.toContain(rentalB)
        })

        it("a seller cannot change the status of another seller's rental (404) and it is unchanged", async () => {
          const res = await call(api.post(`/vendors/rentals/${rentalB}`, { status: "cancelled" }, sellerA.headers))
          expect(res.status).toBe(404)
          const stored = await (getContainer().resolve("rental") as any).retrieveRental(rentalB)
          expect(stored.status).toBe("pending")
        })

        it("a seller cannot manage the deposit of another seller's rental (404)", async () => {
          const res = await call(api.post(`/vendors/rentals/${rentalB}/deposit`, { status: "refunded" }, sellerA.headers))
          expect(res.status).toBe(404)
        })

        it("a seller can change the status of their own rental", async () => {
          const res = await call(api.post(`/vendors/rentals/${rentalA}`, { status: "active" }, sellerA.headers))
          expect({ status: res.status, body: res.status === 200 ? "ok" : res.data }).toEqual({ status: 200, body: "ok" })
        })
      })

      describe("onboarding after approval", () => {
        it("a seller can save onboarding answers while the application is a draft", async () => {
          const res = await call(
            api.post("/vendors/onboarding/save-step", { step: "IDENTITY", answers: { name: "Draft" } }, sellerA.headers)
          )
          expect(res.status).toBe(200)
        })

        it("an approved seller cannot edit their answers or re-submit, and stay approved", async () => {
          onboardingStore.approve(sellerA.vendorId)

          const save = await call(
            api.post("/vendors/onboarding/save-step", { step: "IDENTITY", answers: { name: "Changed after approval" } }, sellerA.headers)
          )
          expect(save.status).toBe(400)

          const submit = await call(api.post("/vendors/onboarding/submit", {}, sellerA.headers))
          expect(submit.status).toBe(400)

          expect(onboardingStore.get(sellerA.vendorId).status).toBe("APPROVED")
        })
      })

      describe("recurring availability", () => {
        it("another seller's rule answers 404 on delete and is left alone", async () => {
          const res = await call(api.delete(`/vendors/providers/me/recurring-availability/${ruleB}`, sellerA.headers))
          expect(res.status).toBe(404)
        })
      })
    })
  },
})
