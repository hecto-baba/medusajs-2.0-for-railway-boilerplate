import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { splitOrderBySeller } from "../../../src/lib/split-order"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 3 of docs/tenant-isolation-and-multi-tenancy.md (also the Phase 2 gate:
 * a two-seller cart shows per-seller shipping and tax AND completes).
 *
 * A cart with two sellers' items completes into one parent order that holds the
 * payment. Each seller gets a child order with only their items and shipping,
 * the parent is linked to no seller, and a ledger row records what each seller
 * is owed. A one-seller cart uses the parent as the seller's order.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("order splitting and seller ledger", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let storeHeaders: { headers: Record<string, string> }
      let parentId: string
      let singleOrderId: string
      let productA: string
      let productB: string
      let optionA: string
      let optionB: string
      let adminHeaders: { headers: { authorization: string } }

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY) as any
      const marketplace = () => getContainer().resolve(MARKETPLACE_MODULE) as any

      const zoneOf = async (locationId: string) => {
        const { data } = await query().graph({
          entity: "stock_location",
          fields: ["fulfillment_sets.service_zones.id"],
          filters: { id: locationId },
        })
        return data[0].fulfillment_sets[0].service_zones[0].id as string
      }

      const setUpSeller = async (seller: TestVendor, label: string, price: number) => {
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
        const product = (
          await must(
            `product ${label}`,
            api.post(
              "/vendors/products",
              {
                title: `${label} product`,
                shipping_profile_id: profile,
                options: [{ title: "Size", values: ["M"] }],
                variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: price }], manage_inventory: false }],
              },
              seller.headers
            )
          )
        ).data.product
        return { option: option as string, product: product.id as string, variantId: product.variants[0].id as string }
      }

      // A cart with the given variants and shipping options, paid with the system provider and completed.
      const completeCart = async (
        regionId: string,
        channelId: string,
        variants: string[],
        options: string[],
        endpoint = "complete-all"
      ) => {
        const cartId = (await must("cart", api.post("/store/carts", { region_id: regionId, sales_channel_id: channelId, email: "buyer@test.local" }, storeHeaders))).data.cart.id
        await must("address", api.post(`/store/carts/${cartId}`, { shipping_address: { first_name: "B", last_name: "Uyer", address_1: "1 St", city: "Town", country_code: "us", postal_code: "10001" } }, storeHeaders))
        for (const variantId of variants) {
          await must("item", api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: 1 }, storeHeaders))
        }
        for (const optionId of options) {
          await must("method", api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionId }, storeHeaders))
        }
        const collection = await must("payment collection", api.post("/store/payment-collections", { cart_id: cartId }, storeHeaders))
        await must(
          "payment session",
          api.post(`/store/payment-collections/${collection.data.payment_collection.id}/payment-sessions`, { provider_id: "pp_system_default" }, storeHeaders)
        )
        const done = await must("complete", api.post(`/store/carts/${cartId}/${endpoint}`, {}, storeHeaders))
        expect(done.data.type).toBe("order")
        return done.data.order.id as string
      }

      const waitForSplits = async (parent: string, expected: number) => {
        for (let i = 0; i < 60; i++) {
          const rows = await marketplace().listVendorOrderSplits({ parent_order_id: parent })
          if (rows.length >= expected) {
            return rows as any[]
          }
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        return (await marketplace().listVendorOrderSplits({ parent_order_id: parent })) as any[]
      }

      const vendorOrders = async (vendorId: string) =>
        ((await query().graph({ entity: "vendor", fields: ["id", "orders.id"], filters: { id: [vendorId] } })).data[0]?.orders ?? []).map((o: any) => o.id) as string[]

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
        const region = await regionModule.createRegions({
          name: "US",
          currency_code: "usd",
          countries: ["us"],
          payment_providers: ["pp_system_default"],
        })
        const taxRegion = await taxModule.createTaxRegions({ country_code: "us", provider_id: "tp_system" })
        await taxModule.createTaxRates({ tax_region_id: taxRegion.id, name: "Platform tax", code: "PLAT", rate: 10, is_default: true })

        const {
          result: [apiKey],
        } = await createApiKeysWorkflow(container).run({
          input: { api_keys: [{ title: "Storefront", type: "publishable", created_by: "test" }] },
        })
        await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: apiKey.id, add: [channel.id] } })
        storeHeaders = { headers: { "x-publishable-api-key": apiKey.token } }

        // An admin user, to settle ledger entries.
        const userModule = container.resolve(Modules.USER) as any
        const authModule = container.resolve(Modules.AUTH) as any
        const registration: any = await api.post("/auth/user/emailpass/register", { email: "admin@payouts.test", password: "supersecret-Test-1" })
        const user = await userModule.createUsers({ email: "admin@payouts.test" })
        const identityId = (await authModule.listAuthIdentities({ provider_identities: { entity_id: "admin@payouts.test" } }))[0]?.id
        await authModule.updateAuthIdentities({ id: identityId, app_metadata: { user_id: user.id } })
        void registration
        const login: any = await api.post("/auth/user/emailpass", { email: "admin@payouts.test", password: "supersecret-Test-1" })
        adminHeaders = { headers: { authorization: `Bearer ${login.data.token}` } }

        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        const a = await setUpSeller(sellerA, "a", 100)
        const b = await setUpSeller(sellerB, "b", 50)
        productA = a.product
        productB = b.product
        optionA = a.option
        optionB = b.option

        parentId = await completeCart(region.id, channel.id, [a.variantId, b.variantId], [a.option, b.option])
        // The single-seller order goes through Medusa's own completion, to show the
        // seller orders do not depend on which completion path placed the order.
        singleOrderId = await completeCart(region.id, channel.id, [a.variantId], [a.option], "complete")
        await waitForSplits(parentId, 2)
        for (let i = 0; i < 60 && !(await vendorOrders(sellerA.vendorId)).includes(singleOrderId); i++) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      })

      it("splits a two-seller order into one child per seller, each with only their own items and shipping", async () => {
        const splits = await waitForSplits(parentId, 2)
        expect(splits).toHaveLength(2)

        for (const [seller, product, option] of [
          [sellerA, productA, optionA],
          [sellerB, productB, optionB],
        ] as Array<[TestVendor, string, string]>) {
          const row = splits.find((s) => s.vendor_id === seller.vendorId)
          expect(row).toBeDefined()
          const {
            data: [child],
          } = await query().graph({
            entity: "order",
            fields: ["id", "metadata", "items.product_id", "shipping_methods.shipping_option_id"],
            filters: { id: row.child_order_id },
          })
          expect(child.metadata.parent_order_id).toBe(parentId)
          expect(child.items.map((i: any) => i.product_id)).toEqual([product])
          expect(child.shipping_methods.map((m: any) => m.shipping_option_id)).toEqual([option])
          expect(await vendorOrders(seller.vendorId)).toContain(row.child_order_id)
        }
      })

      it("links the parent to no seller, so neither seller can open the whole order", async () => {
        expect(await vendorOrders(sellerA.vendorId)).not.toContain(parentId)
        expect(await vendorOrders(sellerB.vendorId)).not.toContain(parentId)
        expect((await call(api.get(`/vendors/orders/${parentId}`, sellerA.headers))).status).toBe(404)
        expect((await call(api.get(`/vendors/orders/${parentId}`, sellerB.headers))).status).toBe(404)
      })

      it("each seller sees their own child in their order list and never the other's", async () => {
        const splits = await waitForSplits(parentId, 2)
        const childA = splits.find((s) => s.vendor_id === sellerA.vendorId).child_order_id
        const childB = splits.find((s) => s.vendor_id === sellerB.vendorId).child_order_id

        const listA = (await call(api.get("/vendors/orders", sellerA.headers))).data.orders.map((o: any) => o.id)
        expect(listA).toContain(childA)
        expect(listA).not.toContain(childB)
        expect((await call(api.get(`/vendors/orders/${childB}`, sellerA.headers))).status).toBe(404)
        expect((await call(api.get(`/vendors/orders/${childA}`, sellerA.headers))).status).toBe(200)
      })

      it("the ledger adds up to the parent order and starts as owed", async () => {
        const splits = await waitForSplits(parentId, 2)
        const {
          data: [parent],
        } = await query().graph({ entity: "order", fields: ["id", "total", "item_total", "shipping_total", "tax_total"], filters: { id: parentId } })

        const sum = (field: string) => Math.round(splits.reduce((acc, s) => acc + Number(s[field]), 0) * 100) / 100
        expect(sum("total")).toBe(Math.round(Number(parent.total) * 100) / 100)
        expect(sum("items_total")).toBe(Math.round(Number(parent.item_total) * 100) / 100)
        expect(sum("shipping_total")).toBe(Math.round(Number(parent.shipping_total) * 100) / 100)
        expect(splits.every((s) => s.payout_status === "owed")).toBe(true)
        // Seller A sells 100 + 10 shipping at the 10% platform rate; seller B 50 + 10.
        expect(splits.find((s) => s.vendor_id === sellerA.vendorId).total).toBe(121)
        expect(splits.find((s) => s.vendor_id === sellerB.vendorId).total).toBe(66)
      })

      it("running the split again creates nothing new", async () => {
        const again = await splitOrderBySeller(getContainer(), parentId)
        expect(again.mode).toBe("split")
        expect(again.created_child_ids).toEqual([])
        expect(await marketplace().listVendorOrderSplits({ parent_order_id: parentId })).toHaveLength(2)
      })

      it("a seller sees only their own ledger entries, with totals by status", async () => {
        const splits = await waitForSplits(parentId, 2)
        const resA = await call(api.get("/vendors/payouts", sellerA.headers))
        expect(resA.status).toBe(200)
        expect(resA.data.payouts.map((p: any) => p.vendor_id)).toEqual([sellerA.vendorId])
        expect(resA.data.payouts[0].child_order_id).toBe(splits.find((s) => s.vendor_id === sellerA.vendorId).child_order_id)
        expect(resA.data.totals.usd.owed).toBe(121)

        const resB = await call(api.get("/vendors/payouts", sellerB.headers))
        expect(resB.data.payouts.map((p: any) => p.vendor_id)).toEqual([sellerB.vendorId])
        expect(resB.data.totals.usd.owed).toBe(66)
      })

      it("only an admin can settle an entry, and a settled entry is final", async () => {
        const splits = await waitForSplits(parentId, 2)
        const entry = splits.find((s) => s.vendor_id === sellerA.vendorId)

        // A seller cannot reach the admin route.
        expect([401, 403]).toContain((await call(api.post(`/admin/vendor-payouts/${entry.id}`, { payout_status: "paid" }, sellerA.headers))).status)

        const paid = await call(api.post(`/admin/vendor-payouts/${entry.id}`, { payout_status: "paid", payout_reference: "BANK-123" }, adminHeaders))
        expect(paid.status).toBe(200)
        expect(paid.data.payout.payout_status).toBe("paid")
        expect(paid.data.payout.payout_reference).toBe("BANK-123")

        const again = await call(api.post(`/admin/vendor-payouts/${entry.id}`, { payout_status: "void" }, adminHeaders))
        expect(again.status).toBe(400)

        const mine = await call(api.get("/vendors/payouts", sellerA.headers))
        expect(mine.data.totals.usd.paid).toBe(121)
        expect(mine.data.totals.usd.owed).toBe(0)

        const list = await call(api.get(`/admin/vendor-payouts?vendor_id=${sellerB.vendorId}`, adminHeaders))
        expect(list.data.payouts.map((p: any) => p.vendor_id)).toEqual([sellerB.vendorId])
      })

      it("canceling the parent order cancels every seller order and voids their entries", async () => {
        const splits = await waitForSplits(parentId, 2)
        await cancelOrderWorkflow(getContainer()).run({ input: { order_id: parentId } })

        let rows: any[] = []
        for (let i = 0; i < 60; i++) {
          rows = await marketplace().listVendorOrderSplits({ parent_order_id: parentId })
          if (rows.every((row) => row.payout_status === "void")) break
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        expect(rows.map((row) => row.payout_status)).toEqual(["void", "void"])

        const { data: children } = await query().graph({
          entity: "order",
          fields: ["id", "status"],
          filters: { id: splits.map((s) => s.child_order_id) },
        })
        expect(children.map((c: any) => c.status)).toEqual(["canceled", "canceled"])
      })

      it("a one-seller order is not split: the parent is the seller's order", async () => {
        expect(await vendorOrders(sellerA.vendorId)).toContain(singleOrderId)
        expect(await vendorOrders(sellerB.vendorId)).not.toContain(singleOrderId)
        expect(await marketplace().listVendorOrderSplits({ parent_order_id: singleOrderId })).toHaveLength(0)
        expect((await call(api.get(`/vendors/orders/${singleOrderId}`, sellerA.headers))).status).toBe(200)
        expect((await call(api.get(`/vendors/orders/${singleOrderId}`, sellerB.headers))).status).toBe(404)
      })
    })
  },
})
