import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 13 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * The seller search used to load EVERY customer, customer group, collection,
 * category and inventory item in the store and filter them in memory, so any
 * seller could read every shopper's name, email and phone and every seller's
 * stock. Each entity is now limited to what the seller may see, in the query.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: search", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let customerA: string
      let customerB: string
      let customerStranger: string
      let groupA: string
      let groupB: string
      let itemA: string
      let itemB: string
      let collectionA: string
      let collectionB: string
      let platformCollection: string
      let publicCategory: string
      let internalCategory: string

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      /** Ids found by searching one entity type. */
      const search = async (seller: TestVendor, q: string, entity: string): Promise<string[]> => {
        const res = await call(api.get(`/vendors/search?q=${encodeURIComponent(q)}&entity=${entity}&limit=50`, seller.headers))
        expect(res.status).toBe(200)
        const group = (res.data.results ?? []).find((r: any) => r.entity === entity)
        return (group?.data ?? []).map((row: any) => row.id)
      }

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        const container = getContainer()
        const productModule = container.resolve(Modules.PRODUCT) as any
        const customerModule = container.resolve(Modules.CUSTOMER) as any

        customerA = (await must("customer A", api.post("/vendors/customers", { email: "findme-a@example.com", first_name: "Findme" }, sellerA.headers))).data
          .customer.id
        customerB = (await must("customer B", api.post("/vendors/customers", { email: "findme-b@example.com", first_name: "Findme" }, sellerB.headers))).data
          .customer.id
        customerStranger = (await customerModule.createCustomers({ email: "findme-stranger@example.com", first_name: "Findme" })).id

        groupA = (await must("group A", api.post("/vendors/customer-groups", { name: "Findme group A" }, sellerA.headers))).data.customer_group.id
        groupB = (await must("group B", api.post("/vendors/customer-groups", { name: "Findme group B" }, sellerB.headers))).data.customer_group.id

        itemA = (await must("item A", api.post("/vendors/inventory-items", { title: "Findme item A", sku: "FINDME-A" }, sellerA.headers))).data.inventory_item.id
        itemB = (await must("item B", api.post("/vendors/inventory-items", { title: "Findme item B", sku: "FINDME-B" }, sellerB.headers))).data.inventory_item.id

        collectionA = (await must("collection A", api.post("/vendors/collections", { title: "Findme collection A" }, sellerA.headers))).data.collection.id
        collectionB = (await must("collection B", api.post("/vendors/collections", { title: "Findme collection B" }, sellerB.headers))).data.collection.id
        platformCollection = (await productModule.createProductCollections([{ title: "Findme platform collection" }]))[0].id

        const categories = await productModule.createProductCategories([
          { name: "Findme public category", is_active: true, is_internal: false },
          { name: "Findme internal category", is_active: true, is_internal: true },
        ])
        publicCategory = categories.find((c: any) => !c.is_internal).id
        internalCategory = categories.find((c: any) => c.is_internal).id
      })

      it("customers: a seller finds their own customers but not another seller's or a stranger's", async () => {
        const ids = await search(sellerA, "findme", "customer")
        expect(ids).toContain(customerA)
        expect(ids).not.toContain(customerB)
        expect(ids).not.toContain(customerStranger)
      })

      it("customers: searching by another shopper's exact email returns nothing", async () => {
        expect(await search(sellerA, "findme-stranger@example.com", "customer")).toEqual([])
      })

      it("customer groups: a seller finds only their own", async () => {
        const ids = await search(sellerA, "findme", "customerGroup")
        expect(ids).toContain(groupA)
        expect(ids).not.toContain(groupB)
      })

      it("inventory: a seller finds only their own items", async () => {
        const ids = await search(sellerA, "findme", "inventory")
        expect(ids).toContain(itemA)
        expect(ids).not.toContain(itemB)
        expect(await search(sellerA, "FINDME-B", "inventory")).toEqual([])
      })

      it("collections: a seller finds their own and shared platform collections, not another seller's", async () => {
        const ids = await search(sellerA, "findme", "collection")
        expect(ids).toContain(collectionA)
        expect(ids).toContain(platformCollection)
        expect(ids).not.toContain(collectionB)
      })

      it("categories: a seller finds public categories but never internal ones", async () => {
        const ids = await search(sellerA, "findme", "category")
        expect(ids).toContain(publicCategory)
        expect(ids).not.toContain(internalCategory)
      })

      it("a search with no matches returns an empty result, not an error", async () => {
        const res = await call(api.get("/vendors/search?q=zzzzzz-no-such-thing", sellerA.headers))
        expect(res.status).toBe(200)
        expect(res.data.results).toEqual([])
      })
    })
  },
})
