import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 8 of docs/tenant-isolation-and-multi-tenancy.md (decision D1).
 *
 *  - A seller READS the customers they created and the customers who ordered
 *    from them, but WRITES only to customers they created.
 *  - A customer who only ordered is shown without addresses or metadata.
 *  - Another seller's customer answers 404 everywhere.
 *  - An address can only be deleted through the customer it belongs to.
 *  - Customer responses list only the seller's own groups, and a seller can
 *    only add or remove their own groups.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: customers", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let customerA: string
      let customerB: string
      let customerStranger: string
      let customerOrdered: string
      let addressB: string
      let groupA: string
      let groupB: string

      const customerModule = () => getContainer().resolve(Modules.CUSTOMER) as any

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      const customerNameOf = async (id: string) => (await customerModule().retrieveCustomer(id)).first_name as string | null

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        customerA = (await must("customer A", api.post("/vendors/customers", { email: "a@example.com", first_name: "Alice" }, sellerA.headers))).data
          .customer.id
        customerB = (await must("customer B", api.post("/vendors/customers", { email: "b@example.com", first_name: "Bob" }, sellerB.headers))).data
          .customer.id

        addressB = (
          await must(
            "address B",
            api.post(
              `/vendors/customers/${customerB}/addresses`,
              { address_1: "1 B Street", city: "Bville", country_code: "us" },
              sellerB.headers
            )
          )
        ).data.customer.addresses[0].id

        groupA = (await must("group A", api.post("/vendors/customer-groups", { name: "A group" }, sellerA.headers))).data.customer_group.id
        groupB = (await must("group B", api.post("/vendors/customer-groups", { name: "B group" }, sellerB.headers))).data.customer_group.id

        // A customer nobody has any relation to.
        customerStranger = (await customerModule().createCustomers({ email: "stranger@example.com", first_name: "Stranger" })).id

        // A customer who ordered from seller A, but was not created by them.
        const ordered = await customerModule().createCustomers({
          email: "ordered@example.com",
          first_name: "Ordered",
          metadata: { secret: "private note" },
        })
        customerOrdered = ordered.id
        await customerModule().createCustomerAddresses({
          customer_id: customerOrdered,
          address_1: "9 Private Road",
          country_code: "us",
        })
        const orderModule = getContainer().resolve(Modules.ORDER) as any
        const order = await orderModule.createOrders({
          currency_code: "usd",
          email: "ordered@example.com",
          customer_id: customerOrdered,
          items: [{ title: "Thing", quantity: 1, unit_price: 100 }],
        })
        const link: any = getContainer().resolve(ContainerRegistrationKeys.LINK)
        await link.create({
          [MARKETPLACE_MODULE]: { vendor_id: sellerA.vendorId },
          [Modules.ORDER]: { order_id: order.id },
        })

        // customerA also belongs to seller B's group (e.g. B once added them as a shared shopper).
        await customerModule().addCustomerToGroup({ customer_id: customerA, customer_group_id: groupB })
      })

      it("a seller can read and update a customer they created", async () => {
        expect((await call(api.get(`/vendors/customers/${customerA}`, sellerA.headers))).status).toBe(200)
        const res = await call(api.post(`/vendors/customers/${customerA}`, { first_name: "Alicia" }, sellerA.headers))
        expect(res.status).toBe(200)
      })

      it("another seller's customer cannot be read, updated or deleted (404) and is unchanged", async () => {
        expect((await call(api.get(`/vendors/customers/${customerB}`, sellerA.headers))).status).toBe(404)
        expect((await call(api.post(`/vendors/customers/${customerB}`, { first_name: "hijacked" }, sellerA.headers))).status).toBe(404)
        expect((await call(api.delete(`/vendors/customers/${customerB}`, sellerA.headers))).status).toBe(404)
        expect(await customerNameOf(customerB)).toBe("Bob")
      })

      it("a customer with no relation to the seller cannot be read (404)", async () => {
        expect((await call(api.get(`/vendors/customers/${customerStranger}`, sellerA.headers))).status).toBe(404)
      })

      it("a seller's customer list excludes other sellers' and unrelated customers", async () => {
        const res = await call(api.get("/vendors/customers", sellerA.headers))
        const ids = (res.data.customers ?? []).map((c: any) => c.id)
        expect(ids).toContain(customerA)
        expect(ids).toContain(customerOrdered)
        expect(ids).not.toContain(customerB)
        expect(ids).not.toContain(customerStranger)
      })

      it("a customer who only ordered is readable but shown without addresses or metadata", async () => {
        const res = await call(api.get(`/vendors/customers/${customerOrdered}`, sellerA.headers))
        expect(res.status).toBe(200)
        expect(res.data.customer.email).toBe("ordered@example.com")
        expect(res.data.customer.addresses ?? []).toEqual([])
        expect(res.data.customer.metadata ?? null).toBeNull()

        const list = await call(api.get("/vendors/customers", sellerA.headers))
        const row = (list.data.customers ?? []).find((c: any) => c.id === customerOrdered)
        expect(row.addresses ?? []).toEqual([])
        expect(row.metadata ?? null).toBeNull()
      })

      it("a customer who only ordered cannot be changed by the seller", async () => {
        const update = await call(api.post(`/vendors/customers/${customerOrdered}`, { first_name: "Changed" }, sellerA.headers))
        expect(update.status).toBe(400)
        expect(await customerNameOf(customerOrdered)).toBe("Ordered")

        const addAddress = await call(
          api.post(`/vendors/customers/${customerOrdered}/addresses`, { address_1: "x", country_code: "us" }, sellerA.headers)
        )
        expect(addAddress.status).toBe(400)

        const readAddresses = await call(api.get(`/vendors/customers/${customerOrdered}/addresses`, sellerA.headers))
        expect(readAddresses.status).toBe(400)
      })

      it("an address of another customer cannot be deleted through the seller's own customer", async () => {
        const res = await call(api.delete(`/vendors/customers/${customerA}/addresses/${addressB}`, sellerA.headers))
        expect(res.status).toBe(404)
        const stored = await customerModule().listCustomerAddresses({ id: [addressB] })
        expect(stored.length).toBe(1)
      })

      it("a customer response lists only the seller's own groups", async () => {
        const added = await call(api.post(`/vendors/customers/${customerA}/customer-groups`, { add: [groupA] }, sellerA.headers))
        expect({ status: added.status, body: added.status === 200 ? "ok" : added.data }).toEqual({ status: 200, body: "ok" })

        const res = await call(api.get(`/vendors/customers/${customerA}`, sellerA.headers))
        const groupIds = (res.data.customer.groups ?? []).map((g: any) => g.id)
        expect(groupIds).not.toContain(groupB)
      })

      it("another seller's group cannot be added to or removed from a customer (404) and membership is unchanged", async () => {
        const add = await call(api.post(`/vendors/customers/${customerA}/customer-groups`, { add: [groupB] }, sellerA.headers))
        expect({ status: add.status, body: add.status === 404 ? "ok" : add.data }).toEqual({ status: 404, body: "ok" })

        const remove = await call(api.post(`/vendors/customers/${customerA}/customer-groups`, { remove: [groupB] }, sellerA.headers))
        expect({ status: remove.status, body: remove.status === 404 ? "ok" : remove.data }).toEqual({ status: 404, body: "ok" })

        const memberships = await customerModule().listCustomerGroupCustomers({ customer_id: [customerA], customer_group_id: [groupB] })
        expect(memberships.length).toBe(1)
      })
    })
  },
})
