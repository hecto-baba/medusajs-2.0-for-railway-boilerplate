import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 11 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * Price lists, promotions and campaigns take ids of their own children in batch
 * bodies (price ids, rule ids, promotion ids). Each id must belong to the
 * resource named in the URL, which belongs to the seller. Otherwise a seller
 * could change or delete another seller's prices and rules, or pull another
 * seller's promotion into their campaign.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: pricing references", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let variantA: string
      let variantB: string
      let priceListA: string
      let priceA: string
      let priceB: string
      let promotionA: string
      let promotionB: string
      let ruleA: string
      let ruleB: string
      let campaignA: string
      let campaignB: string
      let groupB: string

      const pricingModule = () => getContainer().resolve(Modules.PRICING) as any
      const promotionModule = () => getContainer().resolve(Modules.PROMOTION) as any

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

      const promotionBody = (code: string) => ({
        code,
        type: "standard",
        status: "active",
        is_automatic: false,
        application_method: { type: "percentage", target_type: "order", allocation: "across", value: 10, currency_code: "usd" },
        rules: [{ attribute: "currency_code", operator: "eq", values: ["usd"] }],
      })

      const amountOf = async (priceId: string) => {
        const rows = await pricingModule().listPrices({ id: [priceId] })
        return rows[0]?.amount as number | undefined
      }

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        variantA = (await must("product A", api.post("/vendors/products", productBody("A product"), sellerA.headers))).data.product.variants[0].id
        variantB = (await must("product B", api.post("/vendors/products", productBody("B product"), sellerB.headers))).data.product.variants[0].id

        const listA = (
          await must(
            "price list A",
            api.post(
              "/vendors/price-lists",
              { title: "A list", prices: [{ variant_id: variantA, currency_code: "usd", amount: 500 }] },
              sellerA.headers
            )
          )
        ).data.price_list
        const listB = (
          await must(
            "price list B",
            api.post(
              "/vendors/price-lists",
              { title: "B list", prices: [{ variant_id: variantB, currency_code: "usd", amount: 700 }] },
              sellerB.headers
            )
          )
        ).data.price_list
        priceListA = listA.id
        priceA = (listA.prices ?? [])[0]?.id
        priceB = (listB.prices ?? [])[0]?.id
        if (!priceA || !priceB) {
          throw new Error(`setup: price ids missing: ${JSON.stringify({ a: listA.prices, b: listB.prices })}`)
        }

        const promoA = (await must("promotion A", api.post("/vendors/promotions", promotionBody("A-PROMO"), sellerA.headers))).data.promotion
        const promoB = (await must("promotion B", api.post("/vendors/promotions", promotionBody("B-PROMO"), sellerB.headers))).data.promotion
        promotionA = promoA.id
        promotionB = promoB.id
        const detailA = (await must("promotion A detail", api.get(`/vendors/promotions/${promotionA}`, sellerA.headers))).data.promotion
        const detailB = (await must("promotion B detail", api.get(`/vendors/promotions/${promotionB}`, sellerB.headers))).data.promotion
        ruleA = (detailA.rules ?? [])[0]?.id
        ruleB = (detailB.rules ?? [])[0]?.id
        if (!ruleA || !ruleB) {
          throw new Error(`setup: rule ids missing: ${JSON.stringify({ a: detailA.rules, b: detailB.rules })}`)
        }

        campaignA = (
          await must("campaign A", api.post("/vendors/campaigns", { name: "A campaign", campaign_identifier: "A-CAMP" }, sellerA.headers))
        ).data.campaign.id

        campaignB = (
          await must("campaign B", api.post("/vendors/campaigns", { name: "B campaign", campaign_identifier: "B-CAMP" }, sellerB.headers))
        ).data.campaign.id

        groupB = (await must("group B", api.post("/vendors/customer-groups", { name: "B group" }, sellerB.headers))).data.customer_group.id
      })

      describe("price list prices", () => {
        it("a seller can update and delete prices of their own list", async () => {
          const res = await call(
            api.post(
              `/vendors/price-lists/${priceListA}/prices/batch`,
              { update: [{ id: priceA, variant_id: variantA, amount: 600 }] },
              sellerA.headers
            )
          )
          expect({ status: res.status, body: res.status === 200 ? "ok" : res.data }).toEqual({ status: 200, body: "ok" })
        })

        it("another seller's price cannot be deleted through the seller's own list (404) and survives", async () => {
          const res = await call(api.post(`/vendors/price-lists/${priceListA}/prices/batch`, { delete: [priceB] }, sellerA.headers))
          expect(res.status).toBe(404)
          expect(await amountOf(priceB)).toBe(700)
        })

        it("another seller's price cannot be updated through the seller's own list (404) and is unchanged", async () => {
          const res = await call(
            api.post(
              `/vendors/price-lists/${priceListA}/prices/batch`,
              { update: [{ id: priceB, variant_id: variantA, amount: 1 }] },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
          expect(await amountOf(priceB)).toBe(700)
        })

        it("a price list cannot target another seller's customer group (404)", async () => {
          const res = await call(
            api.post(
              "/vendors/price-lists",
              { title: "Targeted", rules: { customer_group_id: [groupB] } },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
        })
      })

      describe("promotion rules", () => {
        it("a seller can update a rule of their own promotion", async () => {
          const res = await call(
            api.post(
              `/vendors/promotions/${promotionA}/rules/batch`,
              { update: [{ id: ruleA, attribute: "currency_code", operator: "eq", values: ["usd"] }] },
              sellerA.headers
            )
          )
          expect({ status: res.status, body: res.status === 200 ? "ok" : res.data }).toEqual({ status: 200, body: "ok" })
        })

        it("another seller's rule cannot be deleted through the seller's own promotion (404) and survives", async () => {
          const res = await call(api.post(`/vendors/promotions/${promotionA}/rules/batch`, { delete: [ruleB] }, sellerA.headers))
          expect(res.status).toBe(404)
          expect((await promotionModule().listPromotionRules({ id: [ruleB] })).length).toBe(1)
        })

        it("another seller's rule cannot be updated through the seller's own promotion (404) and is unchanged", async () => {
          const res = await call(
            api.post(
              `/vendors/promotions/${promotionA}/rules/batch`,
              { update: [{ id: ruleB, attribute: "currency_code", operator: "eq", values: ["eur"] }] },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
          const stored = (await promotionModule().listPromotionRules({ id: [ruleB] }, { relations: ["values"] }))[0]
          expect((stored.values ?? []).map((v: any) => v.value)).toEqual(["usd"])
        })
      })

      describe("campaign promotions", () => {
        // The request validator already refuses a promotions list on a campaign
        // ("Unrecognized fields"), so that path is closed. The checks below pin it
        // down, along with the real route: a promotion joins a campaign through its
        // own campaign_id.
        it("a campaign update refuses a promotions list (400) and the promotion is unchanged", async () => {
          const res = await call(api.post(`/vendors/campaigns/${campaignA}`, { promotions: [{ id: promotionB }] }, sellerA.headers))
          expect(res.status).toBe(400)
          const stored = await promotionModule().retrievePromotion(promotionB)
          expect(stored.campaign_id ?? null).toBeNull()
        })

        it("a campaign create refuses a promotions list (400)", async () => {
          const res = await call(
            api.post(
              "/vendors/campaigns",
              { name: "Stolen", campaign_identifier: "STOLEN", promotions: [{ id: promotionB }] },
              sellerA.headers
            )
          )
          expect(res.status).toBe(400)
        })

        it("a promotion can join the seller's own campaign through campaign_id", async () => {
          const res = await call(api.post(`/vendors/promotions/${promotionA}`, { campaign_id: campaignA }, sellerA.headers))
          expect({ status: res.status, body: res.status === 200 ? "ok" : res.data }).toEqual({ status: 200, body: "ok" })
        })

        it("a promotion cannot join another seller's campaign (404)", async () => {
          const res = await call(api.post(`/vendors/promotions/${promotionA}`, { campaign_id: campaignB }, sellerA.headers))
          expect(res.status).toBe(404)
        })
      })
    })
  },
})
