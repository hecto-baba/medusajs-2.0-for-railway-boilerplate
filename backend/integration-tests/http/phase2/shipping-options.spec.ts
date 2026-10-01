import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 2, step 2 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A seller manages shipping options only inside their OWN service zones (the
 * zone of their own stock location). Another seller's zone, profile, type,
 * option or price answers 404 and is never listed.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: shipping options", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let sellerEmpty: TestVendor
      let zoneA: string
      let zoneB: string
      let profileA: string
      let profileB: string
      let typeA: string
      let typeB: string
      let optionA: string
      let optionB: string
      let priceB: string

      const zoneOf = async (locationId: string) => {
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "stock_location",
          fields: ["fulfillment_sets.service_zones.id"],
          filters: { id: locationId },
        })
        return (data[0] as any).fulfillment_sets[0].service_zones[0].id as string
      }

      const body = (zone: string, profile: string, type: string, extra: Record<string, unknown> = {}) => ({
        name: "Standard",
        service_zone_id: zone,
        shipping_profile_id: profile,
        shipping_option_type_id: type,
        prices: [{ currency_code: "usd", amount: 5 }],
        ...extra,
      })

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        sellerEmpty = await createTestVendor(api, "empty")

        const address = { address_1: "1 Street", city: "Town", country_code: "us" }
        const la = await api.post("/vendors/stock-locations", { name: "A", address }, sellerA.headers)
        const lb = await api.post("/vendors/stock-locations", { name: "B", address }, sellerB.headers)
        zoneA = await zoneOf(la.data.stock_location.id)
        zoneB = await zoneOf(lb.data.stock_location.id)

        profileA = (await api.post("/vendors/shipping-profiles", { name: "A profile", type: "a-default" }, sellerA.headers)).data.shipping_profile.id
        profileB = (await api.post("/vendors/shipping-profiles", { name: "B profile", type: "b-default" }, sellerB.headers)).data.shipping_profile.id
        typeA = (await api.post("/vendors/shipping-option-types", { label: "A std", code: "a-std" }, sellerA.headers)).data.shipping_option_type.id
        typeB = (await api.post("/vendors/shipping-option-types", { label: "B std", code: "b-std" }, sellerB.headers)).data.shipping_option_type.id

        const a = await api.post("/vendors/shipping-options", body(zoneA, profileA, typeA, { name: "A standard" }), sellerA.headers)
        const b = await api.post("/vendors/shipping-options", body(zoneB, profileB, typeB, { name: "B standard" }), sellerB.headers)
        optionA = a.data.shipping_option.id
        optionB = b.data.shipping_option.id
        priceB = b.data.shipping_option.prices[0].id
      })

      it("a seller creates, reads, updates and deletes options in their own zone", async () => {
        const read = await call(api.get(`/vendors/shipping-options/${optionA}`, sellerA.headers))
        expect(read.status).toBe(200)
        expect(read.data.shipping_option.name).toBe("A standard")

        const update = await call(api.post(`/vendors/shipping-options/${optionA}`, { name: "A renamed" }, sellerA.headers))
        expect(update.status).toBe(200)
        expect(update.data.shipping_option.name).toBe("A renamed")

        const extra = await call(api.post("/vendors/shipping-options", body(zoneA, profileA, typeA, { name: "A throwaway" }), sellerA.headers))
        expect(extra.status).toBe(201)
        const del = await call(api.delete(`/vendors/shipping-options/${extra.data.shipping_option.id}`, sellerA.headers))
        expect(del.status).toBe(200)
      })

      it("creates storefront options only: the seller cannot set rules", async () => {
        const read = await call(api.get(`/vendors/shipping-options/${optionA}`, sellerA.headers))
        const rules = read.data.shipping_option.rules.map((r: any) => `${r.attribute}=${r.value}`).sort()
        expect(rules).toEqual(["enabled_in_store=true", "is_return=false"])

        const withRules = await call(
          api.post(
            "/vendors/shipping-options",
            body(zoneA, profileA, typeA, { rules: [{ attribute: "enabled_in_store", value: "false", operator: "eq" }] }),
            sellerA.headers
          )
        )
        expect(withRules.status).toBe(400)
      })

      it("lists only the seller's own options", async () => {
        const a = await call(api.get("/vendors/shipping-options", sellerA.headers))
        expect(a.data.shipping_options.map((o: any) => o.id)).toEqual([optionA])

        const b = await call(api.get("/vendors/shipping-options", sellerB.headers))
        expect(b.data.shipping_options.map((o: any) => o.id)).toEqual([optionB])

        const none = await call(api.get("/vendors/shipping-options", sellerEmpty.headers))
        expect(none.status).toBe(200)
        expect(none.data.shipping_options).toEqual([])
      })

      it("another seller's option answers 404 on read, update and delete", async () => {
        expect((await call(api.get(`/vendors/shipping-options/${optionA}`, sellerB.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/shipping-options/${optionA}`, { name: "hijack" }, sellerB.headers))).status).toBe(404)
        expect((await call(api.delete(`/vendors/shipping-options/${optionA}`, sellerB.headers))).status).toBe(404)
        expect((await call(api.get(`/vendors/shipping-options/${optionA}`, sellerEmpty.headers))).status).toBe(404)

        const still = await call(api.get(`/vendors/shipping-options/${optionA}`, sellerA.headers))
        expect(still.data.shipping_option.name).not.toBe("hijack")
      })

      it("cannot create an option in another seller's zone", async () => {
        const res = await call(api.post("/vendors/shipping-options", body(zoneB, profileA, typeA), sellerA.headers))
        expect(res.status).toBe(404)
        const asEmpty = await call(api.post("/vendors/shipping-options", body(zoneA, profileA, typeA), sellerEmpty.headers))
        expect(asEmpty.status).toBe(404)
      })

      it("cannot use another seller's profile or option type", async () => {
        const badProfile = await call(api.post("/vendors/shipping-options", body(zoneA, profileB, typeA), sellerA.headers))
        expect(badProfile.status).toBe(404)
        const badType = await call(api.post("/vendors/shipping-options", body(zoneA, profileA, typeB), sellerA.headers))
        expect(badType.status).toBe(404)

        const badUpdate = await call(
          api.post(`/vendors/shipping-options/${optionA}`, { shipping_profile_id: profileB }, sellerA.headers)
        )
        expect(badUpdate.status).toBe(404)
      })

      it("cannot rewrite a price on another seller's option through your own", async () => {
        const res = await call(
          api.post(`/vendors/shipping-options/${optionA}`, { prices: [{ id: priceB, amount: 0 }] }, sellerA.headers)
        )
        expect(res.status).toBe(404)

        const b = await call(api.get(`/vendors/shipping-options/${optionB}`, sellerB.headers))
        expect(b.data.shipping_option.prices.find((p: any) => p.id === priceB).amount).toBe(5)
      })

      it("refuses a fulfilment provider that is not linked to the location", async () => {
        const res = await call(
          api.post("/vendors/shipping-options", body(zoneA, profileA, typeA, { provider_id: "not-a-provider" }), sellerA.headers)
        )
        expect(res.status).toBe(400)
      })
    })
  },
})
