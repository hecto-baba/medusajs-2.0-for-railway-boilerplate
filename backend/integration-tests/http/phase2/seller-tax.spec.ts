import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 2, step 4 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A seller owns their tax rates (404 for anyone else). A seller's rate applies
 * to that seller's products and shipping only; everything else keeps the
 * platform's default rate. Sellers cannot set rules or make a rate the default.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller tax rates", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let storeHeaders: { headers: Record<string, string> }
      let taxRegionId: string
      let rateA: string
      let productA2: string
      let optionA: string
      let optionB: string
      let cartId: string
      let variantA: string
      let variantB: string
      let productA: string

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      const zoneOf = async (locationId: string) => {
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "stock_location",
          fields: ["fulfillment_sets.service_zones.id"],
          filters: { id: locationId },
        })
        return (data[0] as any).fulfillment_sets[0].service_zones[0].id as string
      }

      const productBody = (title: string, profile: string) => ({
        title,
        shipping_profile_id: profile,
        options: [{ title: "Size", values: ["M"] }],
        variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 100 }], manage_inventory: false }],
      })

      const setUpSeller = async (seller: TestVendor, label: string) => {
        const profile = (await must(`profile ${label}`, api.post("/vendors/shipping-profiles", { name: `${label} profile`, type: `${label}-default` }, seller.headers))).data.shipping_profile.id
        const type = (await must(`type ${label}`, api.post("/vendors/shipping-option-types", { label: `${label} std`, code: `${label}-std` }, seller.headers))).data.shipping_option_type.id
        const location = (
          await must(`location ${label}`, api.post("/vendors/stock-locations", { name: `${label} wh`, address: { address_1: "1 St", city: "Town", country_code: "us" } }, seller.headers))
        ).data.stock_location.id
        const option = (
          await must(
            `option ${label}`,
            api.post(
              "/vendors/shipping-options",
              {
                name: `${label} ship`,
                service_zone_id: await zoneOf(location),
                shipping_profile_id: profile,
                shipping_option_type_id: type,
                prices: [{ currency_code: "usd", amount: 10 }],
              },
              seller.headers
            )
          )
        ).data.shipping_option.id
        const product = (await must(`product ${label}`, api.post("/vendors/products", productBody(`${label} product`, profile), seller.headers))).data.product
        return { profile, option: option as string, product: product.id as string, variantId: product.variants[0].id as string }
      }

      beforeAll(async () => {
        const container = getContainer()
        const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any
        const storeModule = container.resolve(Modules.STORE) as any
        const regionModule = container.resolve(Modules.REGION) as any
        const taxModule = container.resolve(Modules.TAX) as any

        const channel = await salesChannelModule.createSalesChannels({ name: "Default" })
        const [store] = await storeModule.listStores()
        if (store) {
          await storeModule.updateStores(store.id, { default_sales_channel_id: channel.id })
        } else {
          await storeModule.createStores({
            name: "Test store",
            supported_currencies: [{ currency_code: "usd", is_default: true }],
            default_sales_channel_id: channel.id,
          })
        }
        const region = await regionModule.createRegions({ name: "US", currency_code: "usd", countries: ["us"] })

        // The platform's tax: one country region with a 10% default rate.
        const taxRegion = await taxModule.createTaxRegions({ country_code: "us", provider_id: "tp_system" })
        taxRegionId = taxRegion.id
        await taxModule.createTaxRates({ tax_region_id: taxRegionId, name: "Platform tax", code: "PLAT", rate: 10, is_default: true })

        const {
          result: [apiKey],
        } = await createApiKeysWorkflow(container).run({
          input: { api_keys: [{ title: "Storefront", type: "publishable", created_by: "test" }] },
        })
        await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: apiKey.id, add: [channel.id] } })
        storeHeaders = { headers: { "x-publishable-api-key": apiKey.token } }

        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        const a = await setUpSeller(sellerA, "a")
        const b = await setUpSeller(sellerB, "b")
        optionA = a.option
        optionB = b.option
        variantA = a.variantId
        variantB = b.variantId
        productA = a.product

        // Seller A sets a 5% rate AFTER their first product and option exist,
        // then adds a second product, which the rate must pick up too.
        rateA = (await must("rate A", api.post("/vendors/tax-rates", { tax_region_id: taxRegionId, name: "A tax", code: "A5", rate: 5 }, sellerA.headers))).data.tax_rate.id
        productA2 = (await must("product A2", api.post("/vendors/products", productBody("a second product", a.profile), sellerA.headers))).data.product.id

        cartId = (await must("cart", api.post("/store/carts", { region_id: region.id, sales_channel_id: channel.id, email: "buyer@test.local" }, storeHeaders))).data.cart.id
        await must("address", api.post(`/store/carts/${cartId}`, { shipping_address: { first_name: "B", last_name: "Uyer", address_1: "1 St", city: "Town", country_code: "us", postal_code: "10001" } }, storeHeaders))
        await must("item a", api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantA, quantity: 1 }, storeHeaders))
        await must("item b", api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantB, quantity: 1 }, storeHeaders))
        await must("method a", api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionA }, storeHeaders))
        await must("method b", api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionB }, storeHeaders))
      })

      it("a seller creates, reads, updates and deletes their own rate", async () => {
        const read = await call(api.get(`/vendors/tax-rates/${rateA}`, sellerA.headers))
        expect(read.status).toBe(200)
        expect(read.data.tax_rate.rate).toBe(5)
        expect(read.data.tax_rate.is_default).toBe(false)

        const update = await call(api.post(`/vendors/tax-rates/${rateA}`, { name: "A tax renamed" }, sellerA.headers))
        expect(update.status).toBe(200)
        expect(update.data.tax_rate.name).toBe("A tax renamed")

        const extra = await call(api.post("/vendors/tax-rates", { tax_region_id: taxRegionId, name: "A throwaway", rate: 1 }, sellerA.headers))
        expect(extra.status).toBe(201)
        const del = await call(api.delete(`/vendors/tax-rates/${extra.data.tax_rate.id}`, sellerA.headers))
        expect(del.status).toBe(200)
      })

      it("another seller's rate answers 404 on read, update and delete, and is never listed", async () => {
        expect((await call(api.get(`/vendors/tax-rates/${rateA}`, sellerB.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/tax-rates/${rateA}`, { rate: 0 }, sellerB.headers))).status).toBe(404)
        expect((await call(api.delete(`/vendors/tax-rates/${rateA}`, sellerB.headers))).status).toBe(404)

        const listB = await call(api.get("/vendors/tax-rates", sellerB.headers))
        expect(listB.status).toBe(200)
        expect(listB.data.tax_rates).toEqual([])

        const listA = await call(api.get("/vendors/tax-rates", sellerA.headers))
        expect(listA.data.tax_rates.map((r: any) => r.id)).toEqual([rateA])
      })

      it("cannot set rules or the default flag, or use a region that does not exist", async () => {
        const withRules = await call(
          api.post(
            "/vendors/tax-rates",
            { tax_region_id: taxRegionId, name: "x", rate: 1, rules: [{ reference: "product", reference_id: "prod_1" }] },
            sellerB.headers
          )
        )
        expect(withRules.status).toBe(400)
        const asDefault = await call(
          api.post("/vendors/tax-rates", { tax_region_id: taxRegionId, name: "x", rate: 1, is_default: true }, sellerB.headers)
        )
        expect(asDefault.status).toBe(400)
        const noRegion = await call(api.post("/vendors/tax-rates", { tax_region_id: "txreg_missing", name: "x", rate: 1 }, sellerB.headers))
        expect(noRegion.status).toBe(404)
      })

      it("the rate covers the seller's products and shipping, including ones added later", async () => {
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "tax_rate",
          fields: ["id", "rules.reference", "rules.reference_id"],
          filters: { id: rateA },
        })
        const refs = ((data[0] as any).rules as any[]).map((r) => `${r.reference}:${r.reference_id}`)
        expect(refs).toEqual(expect.arrayContaining([`product:${productA}`, `product:${productA2}`, `shipping_option:${optionA}`]))
        expect(refs).not.toContain(`shipping_option:${optionB}`)
      })

      it("taxes each seller's items and shipping with their own rate, others with the platform's", async () => {
        const cart = await must("cart", api.get(`/store/carts/${cartId}`, storeHeaders))
        const items = cart.data.cart.items as any[]
        const rateOfVariant = (variantId: string) =>
          items.find((i) => i.variant_id === variantId).tax_lines.map((t: any) => t.rate)
        expect(rateOfVariant(variantA)).toEqual([5])
        expect(rateOfVariant(variantB)).toEqual([10])

        const methods = cart.data.cart.shipping_methods as any[]
        const rateOfOption = (optionId: string) =>
          methods.find((m) => m.shipping_option_id === optionId).tax_lines.map((t: any) => t.rate)
        expect(rateOfOption(optionA)).toEqual([5])
        expect(rateOfOption(optionB)).toEqual([10])
      })
    })
  },
})
