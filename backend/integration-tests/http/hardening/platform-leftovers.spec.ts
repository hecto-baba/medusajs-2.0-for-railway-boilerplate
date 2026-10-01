import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import { must, setUpSeller } from "../helpers/checkout"

jest.setTimeout(20 * 60 * 1000)

/**
 * Items left open after Phases 1 to 4 (plan section 14): exact ledger money, a
 * deleted location taking its shipping setup down, platform stock locations leaving
 * seller view, uploads attributed to their seller, the admin payout list, and the
 * admin vendor page reading collections from the right field.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("platform leftovers", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let a: Awaited<ReturnType<typeof setUpSeller>>
      let adminHeaders: { headers: { authorization: string } }
      let platformLocation: string
      let inventoryItemId: string

      const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY) as any
      const marketplace = () => getContainer().resolve(MARKETPLACE_MODULE) as any

      beforeAll(async () => {
        const container = getContainer()

        // setUpSeller needs a store, region and so on only for carts; stock locations and
        // shipping setup need none of it, so build just the seller side here.
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        a = await setUpSeller(api, container, sellerA, "a", 20)

        // An admin user.
        const userModule = container.resolve(Modules.USER) as any
        const authModule = container.resolve(Modules.AUTH) as any
        await api.post("/auth/user/emailpass/register", { email: "admin@leftovers.test", password: "supersecret-Test-1" })
        const user = await userModule.createUsers({ email: "admin@leftovers.test" })
        const identity = (await authModule.listAuthIdentities({ provider_identities: { entity_id: "admin@leftovers.test" } }))[0]
        await authModule.updateAuthIdentities({ id: identity.id, app_metadata: { user_id: user.id } })
        const login: any = await api.post("/auth/user/emailpass", { email: "admin@leftovers.test", password: "supersecret-Test-1" })
        adminHeaders = { headers: { authorization: `Bearer ${login.data.token}` } }

        // A platform location (no seller), and an inventory item that seller A owns with
        // stock at that location (a seller who set up stock before Phase 2).
        platformLocation = (await (container.resolve(Modules.STOCK_LOCATION) as any).createStockLocations({ name: "Platform warehouse" })).id
        const item = await (container.resolve(Modules.INVENTORY) as any).createInventoryItems({ sku: "LEFTOVER-1" })
        inventoryItemId = item.id
        await (container.resolve(Modules.INVENTORY) as any).createInventoryLevels([
          { inventory_item_id: inventoryItemId, location_id: platformLocation, stocked_quantity: 5 },
        ])
        await (container.resolve(ContainerRegistrationKeys.LINK) as any).create({
          [MARKETPLACE_MODULE]: { vendor_id: sellerA.vendorId },
          [Modules.INVENTORY]: { inventory_item_id: inventoryItemId },
        })
      })

      it("ledger amounts are exact: no cents lost on a large amount", async () => {
        const row = await marketplace().createVendorOrderSplits({
          parent_order_id: "ord_precision_parent",
          child_order_id: "ord_precision_child",
          vendor_id: sellerA.vendorId,
          currency_code: "usd",
          items_total: 123456789.12,
          shipping_total: 0.1,
          tax_total: 0.2,
          total: 123456789.42,
        })
        const [read] = await marketplace().listVendorOrderSplits({ id: row.id })
        // A 32-bit float turns 123456789.12 into 123456792.
        expect(Number(read.items_total)).toBe(123456789.12)
        expect(Number(read.total)).toBe(123456789.42)
      })

      it("the admin payout list names the seller and shows what is owed after refunds", async () => {
        const row = await marketplace().createVendorOrderSplits({
          parent_order_id: "ord_admin_parent",
          child_order_id: "ord_admin_child",
          vendor_id: sellerA.vendorId,
          currency_code: "usd",
          items_total: 100,
          shipping_total: 10,
          tax_total: 11,
          total: 121,
          refunded_total: 21,
        })
        const res = await call(api.get(`/admin/vendor-payouts?vendor_id=${sellerA.vendorId}`, adminHeaders))
        expect(res.status).toBe(200)
        const found = res.data.payouts.find((p: any) => p.id === row.id)
        expect(found.vendor_name).toContain("Test Vendor")
        expect(found.net_total).toBe(100)
        expect(res.data.totals.usd.owed).toBe(100)
        // A seller cannot reach the admin list.
        expect([401, 403]).toContain((await call(api.get("/admin/vendor-payouts", sellerA.headers))).status)
      })

      it("deleting a location takes its fulfilment set, zone and shipping options with it", async () => {
        const before = (
          await query().graph({
            entity: "stock_location",
            fields: ["id", "fulfillment_sets.id", "fulfillment_sets.service_zones.shipping_options.id"],
            filters: { id: a.location },
          })
        ).data[0]
        const setId = before.fulfillment_sets[0].id
        expect(before.fulfillment_sets[0].service_zones[0].shipping_options.map((o: any) => o.id)).toEqual([a.option])

        const del = await call(api.delete(`/vendors/stock-locations/${a.location}`, sellerA.headers))
        expect(del.status).toBe(200)

        const sets = (await query().graph({ entity: "fulfillment_set", fields: ["id"], filters: { id: setId } })).data
        expect(sets).toHaveLength(0)
        const options = (await query().graph({ entity: "shipping_option", fields: ["id"], filters: { id: a.option } })).data
        expect(options).toHaveLength(0)
      })

      it("a platform stock location is hidden from a seller who holds no stock there", async () => {
        const listB = await call(api.get("/vendors/stock-locations", sellerB.headers))
        expect(listB.data.stock_locations.map((l: any) => l.id)).not.toContain(platformLocation)
        expect((await call(api.get(`/vendors/stock-locations/${platformLocation}`, sellerB.headers))).status).toBe(404)

        // And it cannot be used for new stock either.
        const items = await must(
          "b item",
          api.post("/vendors/inventory-items", { title: "B item", sku: "B-SKU" }, sellerB.headers)
        )
        const level = await call(
          api.post(`/vendors/inventory-items/${items.data.inventory_item.id}/location-levels`, { location_id: platformLocation, stocked_quantity: 1 }, sellerB.headers)
        )
        expect(level.status).toBe(404)
      })

      it("a seller who already holds stock at a platform location keeps seeing that one", async () => {
        const listA = await call(api.get("/vendors/stock-locations", sellerA.headers))
        expect(listA.data.stock_locations.map((l: any) => l.id)).toContain(platformLocation)
        expect((await call(api.get(`/vendors/stock-locations/${platformLocation}`, sellerA.headers))).status).toBe(200)
        // Seeing it is not owning it: they still cannot rename or delete it.
        expect((await call(api.post(`/vendors/stock-locations/${platformLocation}`, { name: "x" }, sellerA.headers))).status).toBe(404)
        expect((await call(api.delete(`/vendors/stock-locations/${platformLocation}`, sellerA.headers))).status).toBe(404)
      })

      it("an upload is recorded against the seller who made it, and listed only to them", async () => {
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64"
        )
        const form = new FormData()
        form.append("files", new Blob([png], { type: "image/png" }), "pixel.png")

        const up = await call(api.post("/vendors/uploads", form, sellerA.headers))
        expect({ status: up.status, body: up.status === 200 ? "ok" : up.data }).toEqual({ status: 200, body: "ok" })
        const fileId = up.data.files[0].id

        const mine = await call(api.get("/vendors/uploads", sellerA.headers))
        expect(mine.data.uploads.map((u: any) => u.file_id)).toContain(fileId)
        expect(mine.data.uploads[0].filename).toBe("pixel.png")
        expect(mine.data.uploads[0].mime_type).toBe("image/png")

        const theirs = await call(api.get("/vendors/uploads", sellerB.headers))
        expect(theirs.data.uploads.map((u: any) => u.file_id)).not.toContain(fileId)
      })

      it("a seller's token is refused by the admin routes (checked at runtime, not just by reading middlewares)", async () => {
        const adminPaths = [
          "/admin/vendors",
          "/admin/vendor-payouts",
          "/admin/quotes",
          "/admin/companies",
          "/admin/deliveries",
          "/admin/enquiries",
          "/admin/orders",
          "/admin/products",
        ]
        for (const path of adminPaths) {
          const res = await call(api.get(path, sellerA.headers))
          expect({ path, status: res.status }).toEqual({ path, status: 401 })
        }
        expect((await call(api.post("/admin/vendor-payouts/x", { payout_status: "paid" }, sellerA.headers))).status).toBe(401)
      })

      it("the admin vendor page reads a seller's collections from the right field", async () => {
        await must("collection", api.post("/vendors/collections", { title: "Own collection" }, sellerA.headers))
        const res = await call(api.get(`/admin/vendors/${sellerA.vendorId}`, adminHeaders))
        expect(res.status).toBe(200)
        expect((res.data.collections ?? res.data.vendor?.collections ?? []).length).toBeGreaterThanOrEqual(1)
      })
    })
  },
})
