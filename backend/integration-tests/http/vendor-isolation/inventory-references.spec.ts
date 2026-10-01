import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 10 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * Inventory requests carry ids in their bodies and paths. A seller may only use
 * stock locations that are their own (or shared platform ones), inventory items
 * that are their own, and line items of their own orders. Anything else answers
 * 404 BEFORE anything is created or changed.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: inventory references", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let locationA: string
      let locationB: string
      let platformLocation: string
      let itemA: string
      let itemB: string
      let itemWithStockEverywhere: string
      let productA: string
      let variantA: string
      let reservationA: string
      let ownLineItem: string
      let foreignLineItem: string

      const inventoryModule = () => getContainer().resolve(Modules.INVENTORY) as any

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      const itemCount = async () => {
        const query: any = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({ entity: "inventory_item", fields: ["id"] })
        return data.length as number
      }

      const levelsOf = async (inventoryItemId: string) =>
        (await inventoryModule().listInventoryLevels({ inventory_item_id: [inventoryItemId] })) as Array<{ location_id: string }>

      const address = { address_1: "1 Test Street", city: "Testville", country_code: "us" }

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        locationA = (await must("location A", api.post("/vendors/stock-locations", { name: "A warehouse", address }, sellerA.headers))).data
          .stock_location.id
        locationB = (await must("location B", api.post("/vendors/stock-locations", { name: "B warehouse", address }, sellerB.headers))).data
          .stock_location.id
        platformLocation = (await (getContainer().resolve(Modules.STOCK_LOCATION) as any).createStockLocations({ name: "Platform warehouse" })).id

        itemA = (await must("item A", api.post("/vendors/inventory-items", { title: "A item", sku: "A-SKU" }, sellerA.headers))).data.inventory_item.id
        itemB = (await must("item B", api.post("/vendors/inventory-items", { title: "B item", sku: "B-SKU" }, sellerB.headers))).data.inventory_item.id

        // An item of A's that already has stock at BOTH locations, as if a past leak had put
        // stock at B's warehouse. Only our check, not missing stock, can now stop a reservation there.
        itemWithStockEverywhere = (
          await must("item A2", api.post("/vendors/inventory-items", { title: "A item 2", sku: "A2-SKU" }, sellerA.headers))
        ).data.inventory_item.id
        await inventoryModule().createInventoryLevels([
          { inventory_item_id: itemWithStockEverywhere, location_id: locationA, stocked_quantity: 10 },
          { inventory_item_id: itemWithStockEverywhere, location_id: locationB, stocked_quantity: 10 },
        ])

        // Stock for A's own item at A's own location (needed to reserve against).
        await must(
          "level A",
          api.post(`/vendors/inventory-items/${itemA}/location-levels`, { location_id: locationA, stocked_quantity: 10 }, sellerA.headers)
        )

        const productBody = {
          title: "A product",
          options: [{ title: "Size", values: ["M"] }],
          variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 10 }], manage_inventory: false }],
        }
        const product = (await must("product A", api.post("/vendors/products", productBody, sellerA.headers))).data.product
        productA = product.id
        variantA = product.variants[0].id

        reservationA = (
          await must(
            "reservation A",
            api.post("/vendors/reservations", { inventory_item_id: itemWithStockEverywhere, location_id: locationA, quantity: 1 }, sellerA.headers)
          )
        ).data.reservation.id

        // One order linked to seller A (own line item) and one linked to nobody (foreign line item).
        const orderModule = getContainer().resolve(Modules.ORDER) as any
        const mine = await orderModule.createOrders({
          currency_code: "usd",
          email: "mine@example.com",
          items: [{ title: "Mine", quantity: 1, unit_price: 100 }],
        })
        const theirs = await orderModule.createOrders({
          currency_code: "usd",
          email: "theirs@example.com",
          items: [{ title: "Theirs", quantity: 1, unit_price: 100 }],
        })
        ownLineItem = mine.items[0].id
        foreignLineItem = theirs.items[0].id
        const link: any = getContainer().resolve(ContainerRegistrationKeys.LINK)
        await link.create({ [MARKETPLACE_MODULE]: { vendor_id: sellerA.vendorId }, [Modules.ORDER]: { order_id: mine.id } })
      })

      describe("stock locations", () => {
        it("an inventory item can be created with levels at the seller's own and a platform location", async () => {
          const res = await call(
            api.post(
              "/vendors/inventory-items",
              {
                title: "Ok item",
                location_levels: [
                  { location_id: locationA, stocked_quantity: 1 },
                  { location_id: platformLocation, stocked_quantity: 2 },
                ],
              },
              sellerA.headers
            )
          )
          expect({ status: res.status, body: res.status === 201 ? "ok" : res.data }).toEqual({ status: 201, body: "ok" })
        })

        it("an inventory item cannot be created with a level at another seller's location (404, nothing created)", async () => {
          const before = await itemCount()
          const res = await call(
            api.post(
              "/vendors/inventory-items",
              { title: "Stolen item", location_levels: [{ location_id: locationB, stocked_quantity: 5 }] },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
          expect(await itemCount()).toBe(before)
        })

        it("a level cannot be created at another seller's location (404, none created)", async () => {
          const res = await call(
            api.post(`/vendors/inventory-items/${itemA}/location-levels`, { location_id: locationB, stocked_quantity: 5 }, sellerA.headers)
          )
          expect(res.status).toBe(404)
          expect((await levelsOf(itemA)).map((l) => l.location_id)).not.toContain(locationB)
        })

        it("a level cannot be set at another seller's location by path (404)", async () => {
          const res = await call(
            api.post(`/vendors/inventory-items/${itemA}/location-levels/${locationB}`, { stocked_quantity: 5 }, sellerA.headers)
          )
          expect(res.status).toBe(404)
          expect((await levelsOf(itemA)).map((l) => l.location_id)).not.toContain(locationB)
        })

        it("the per-item batch refuses another seller's location (404, none created)", async () => {
          const res = await call(
            api.post(
              `/vendors/inventory-items/${itemA}/location-levels/batch`,
              { create: [{ location_id: locationB, stocked_quantity: 5 }] },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
          expect((await levelsOf(itemA)).map((l) => l.location_id)).not.toContain(locationB)
        })

        it("the cross-item batch refuses another seller's location (404, none created)", async () => {
          const res = await call(
            api.post(
              "/vendors/inventory-items/location-levels/batch",
              { create: [{ inventory_item_id: itemA, location_id: locationB, stocked_quantity: 5 }] },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
          expect((await levelsOf(itemA)).map((l) => l.location_id)).not.toContain(locationB)
        })

        it("a variant's stock cannot be set at another seller's location (404)", async () => {
          const res = await call(
            api.post(
              `/vendors/products/${productA}/variants/${variantA}/inventory-levels`,
              { location_id: locationB, stocked_quantity: 3 },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
        })

        it("a variant's stock can be set at the seller's own location", async () => {
          const res = await call(
            api.post(
              `/vendors/products/${productA}/variants/${variantA}/inventory-levels`,
              { location_id: locationA, stocked_quantity: 3 },
              sellerA.headers
            )
          )
          expect({ status: res.status, body: res.status < 300 ? "ok" : res.data }).toEqual({ status: res.status, body: "ok" })
        })
      })

      describe("reservations", () => {
        it("a reservation cannot be created at another seller's location (404)", async () => {
          const res = await call(
            api.post("/vendors/reservations", { inventory_item_id: itemWithStockEverywhere, location_id: locationB, quantity: 1 }, sellerA.headers)
          )
          expect(res.status).toBe(404)
        })

        it("a reservation cannot name a line item of an order the seller has no part in (404)", async () => {
          const res = await call(
            api.post(
              "/vendors/reservations",
              { inventory_item_id: itemWithStockEverywhere, location_id: locationA, quantity: 1, line_item_id: foreignLineItem },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
        })

        it("a reservation can name a line item of the seller's own order", async () => {
          const res = await call(
            api.post(
              "/vendors/reservations",
              { inventory_item_id: itemWithStockEverywhere, location_id: locationA, quantity: 1, line_item_id: ownLineItem },
              sellerA.headers
            )
          )
          expect({ status: res.status, body: res.status === 201 ? "ok" : res.data }).toEqual({ status: 201, body: "ok" })
        })

        it("a reservation cannot be moved to another seller's location (404)", async () => {
          const res = await call(api.post(`/vendors/reservations/${reservationA}`, { location_id: locationB }, sellerA.headers))
          expect(res.status).toBe(404)
        })
      })

      describe("variant inventory links", () => {
        it("another seller's inventory item cannot be attached to the seller's variant (404)", async () => {
          const res = await call(
            api.post(
              `/vendors/products/${productA}/variants/${variantA}/inventory-items`,
              { inventory_item_id: itemB, required_quantity: 1 },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
        })

        it("the seller's own inventory item can be attached to their variant", async () => {
          const res = await call(
            api.post(
              `/vendors/products/${productA}/variants/${variantA}/inventory-items`,
              { inventory_item_id: itemA, required_quantity: 1 },
              sellerA.headers
            )
          )
          expect({ status: res.status, body: res.status === 200 ? "ok" : res.data }).toEqual({ status: 200, body: "ok" })
        })

        it("another seller's item cannot be updated or detached through the seller's variant (404)", async () => {
          const update = await call(
            api.post(
              `/vendors/products/${productA}/variants/${variantA}/inventory-items/${itemB}`,
              { required_quantity: 5 },
              sellerA.headers
            )
          )
          expect(update.status).toBe(404)

          const detach = await call(
            api.delete(`/vendors/products/${productA}/variants/${variantA}/inventory-items/${itemB}`, sellerA.headers)
          )
          expect(detach.status).toBe(404)
        })

        it("the batch refuses another seller's inventory item (404)", async () => {
          const res = await call(
            api.post(
              `/vendors/products/${productA}/variants/inventory-items/batch`,
              { create: [{ variant_id: variantA, inventory_item_id: itemB, required_quantity: 1 }] },
              sellerA.headers
            )
          )
          expect(res.status).toBe(404)
        })
      })
    })
  },
})
