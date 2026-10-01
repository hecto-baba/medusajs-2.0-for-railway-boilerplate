import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 2, step 3 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A cart with items from two sellers must offer each seller's own options for
 * that seller's items only, allow one method per seller at the same time, and
 * refuse an option that ships nothing in the cart (another seller's).
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("checkout shipping per seller", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let sellerC: TestVendor
      let storeHeaders: { headers: Record<string, string> }
      let cartId: string
      let optionA: string
      let optionB: string
      let optionC: string

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

      // A seller with a profile, a zone and one shipping option; returns what the cart needs.
      const setUpSeller = async (seller: TestVendor, label: string, price: number) => {
        const profile = (
          await must(`profile ${label}`, api.post("/vendors/shipping-profiles", { name: `${label} profile`, type: `${label}-default` }, seller.headers))
        ).data.shipping_profile.id
        const type = (
          await must(`type ${label}`, api.post("/vendors/shipping-option-types", { label: `${label} std`, code: `${label}-std` }, seller.headers))
        ).data.shipping_option_type.id
        const location = (
          await must(
            `location ${label}`,
            api.post("/vendors/stock-locations", { name: `${label} warehouse`, address: { address_1: "1 St", city: "Town", country_code: "us" } }, seller.headers)
          )
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
                prices: [{ currency_code: "usd", amount: price }],
              },
              seller.headers
            )
          )
        ).data.shipping_option.id
        const product = (
          await must(
            `product ${label}`,
            api.post(
              "/vendors/products",
              {
                title: `${label} product`,
                shipping_profile_id: profile,
                options: [{ title: "Size", values: ["M"] }],
                variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 10 }], manage_inventory: false }],
              },
              seller.headers
            )
          )
        ).data.product
        return { option: option as string, variantId: product.variants[0].id as string }
      }

      beforeAll(async () => {
        const container = getContainer()
        const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any
        const storeModule = container.resolve(Modules.STORE) as any
        const regionModule = container.resolve(Modules.REGION) as any

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

        const {
          result: [apiKey],
        } = await createApiKeysWorkflow(container).run({
          input: { api_keys: [{ title: "Storefront", type: "publishable", created_by: "test" }] },
        })
        await linkSalesChannelsToApiKeyWorkflow(container).run({
          input: { id: apiKey.id, add: [channel.id] },
        })
        storeHeaders = { headers: { "x-publishable-api-key": apiKey.token } }

        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        sellerC = await createTestVendor(api, "c")
        const a = await setUpSeller(sellerA, "a", 5)
        const b = await setUpSeller(sellerB, "b", 7)
        const c = await setUpSeller(sellerC, "c", 9)
        optionA = a.option
        optionB = b.option
        optionC = c.option

        const cart = await must(
          "cart",
          api.post("/store/carts", { region_id: region.id, sales_channel_id: channel.id, email: "buyer@test.local" }, storeHeaders)
        )
        cartId = cart.data.cart.id
        await must("address", api.post(`/store/carts/${cartId}`, { shipping_address: { first_name: "B", last_name: "Uyer", address_1: "1 St", city: "Town", country_code: "us", postal_code: "10001" } }, storeHeaders))
        await must("item a", api.post(`/store/carts/${cartId}/line-items`, { variant_id: a.variantId, quantity: 1 }, storeHeaders))
        await must("item b", api.post(`/store/carts/${cartId}/line-items`, { variant_id: b.variantId, quantity: 1 }, storeHeaders))
      })

      it("offers each seller's own options for that seller's items only", async () => {
        const res = await must("groups", api.get(`/store/carts/${cartId}/seller-shipping-options`, storeHeaders))
        const groups = res.data.shipping_groups
        expect(groups).toHaveLength(2)

        const byVendor = new Map<string, string[]>(
          groups.map((g: any) => [g.vendor.id, g.shipping_options.map((o: any) => o.id)])
        )
        expect(byVendor.get(sellerA.vendorId)).toEqual([optionA])
        expect(byVendor.get(sellerB.vendorId)).toEqual([optionB])
        expect(groups.every((g: any) => g.item_ids.length === 1)).toBe(true)
        expect(groups.find((g: any) => g.vendor.id === sellerA.vendorId).shipping_options[0].amount).toBe(5)
      })

      it("keeps one method per seller: choosing for B does not replace A's choice", async () => {
        await must("method a", api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionA }, storeHeaders))
        await must("method b", api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionB }, storeHeaders))

        const cart = await must("cart", api.get(`/store/carts/${cartId}`, storeHeaders))
        const optionIds = cart.data.cart.shipping_methods.map((m: any) => m.shipping_option_id).sort()
        expect(optionIds).toEqual([optionA, optionB].sort())
      })

      it("refuses an option from a seller who has nothing in the cart", async () => {
        const res = await call(api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionC }, storeHeaders))
        expect(res.status).toBe(400)

        const cart = await must("cart", api.get(`/store/carts/${cartId}`, storeHeaders))
        expect(cart.data.cart.shipping_methods.map((m: any) => m.shipping_option_id)).not.toContain(optionC)
      })
    })
  },
})
