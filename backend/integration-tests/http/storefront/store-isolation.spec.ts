import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrdersWorkflow } from "@medusajs/medusa/core-flows"
import { APPROVAL_MODULE } from "../../../src/modules/approval"
import { COMPANY_MODULE } from "../../../src/modules/company"
import { QUOTE_MODULE } from "../../../src/modules/quote"
import { call } from "../helpers/vendors"
import { createTestCustomer, TestCustomer } from "../helpers/customers"
import { must, setUpStorefront, Storefront } from "../helpers/checkout"

jest.setTimeout(20 * 60 * 1000)

/**
 * The storefront side of tenant isolation (the audit of /store and /admin that
 * followed Phase 4): an order, a quote, a cart or an approval is reachable only
 * by the customer it belongs to (and their company), never by someone who merely
 * holds its id. Guests keep their own handle: an ownerless quote or cart, and a
 * guest order, work by id alone.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("storefront isolation", () => {
      let storefront: Storefront
      let anon: { headers: Record<string, string> }
      let alice: TestCustomer
      let bob: TestCustomer
      let boss1: TestCustomer
      let boss2: TestCustomer
      let aliceOrder: string
      let guestOrder: string
      let childOrder: string
      let aliceQuote: string
      let guestQuote: string
      let aliceCart: string
      let approvalOfCompany2: string

      const orderBody = (extra: Record<string, unknown>) =>
        ({
          currency_code: "usd",
          region_id: storefront.regionId,
          sales_channel_id: storefront.channelId,
          status: "pending",
          items: [{ title: "Thing", quantity: 1, unit_price: 10 }],
          ...extra,
        }) as any

      beforeAll(async () => {
        const container = getContainer()
        storefront = await setUpStorefront(container)
        anon = storefront.storeHeaders

        alice = await createTestCustomer(api, storefront.storeHeaders, "alice")
        bob = await createTestCustomer(api, storefront.storeHeaders, "bob")
        boss1 = await createTestCustomer(api, storefront.storeHeaders, "boss1")
        boss2 = await createTestCustomer(api, storefront.storeHeaders, "boss2")

        // --- orders: alice's, a guest's, and a seller's child order (no customer)
        aliceOrder = ((await createOrdersWorkflow(container).run({ input: orderBody({ email: alice.email, customer_id: alice.customerId }) })).result as any).id
        guestOrder = ((await createOrdersWorkflow(container).run({ input: orderBody({ email: "guest@guests.test" }) })).result as any).id
        childOrder = ((await createOrdersWorkflow(container).run({ input: orderBody({ email: alice.email, metadata: { split_child: true, parent_order_id: aliceOrder } }) })).result as any).id

        // --- quotes: alice's, and a guest's (nobody owns it yet)
        const quotes = container.resolve(QUOTE_MODULE) as any
        aliceQuote = (await quotes.createQuotes({ customer_id: alice.customerId, status: "pending_customer" })).id
        guestQuote = (await quotes.createQuotes({ status: "pending_customer" })).id

        // --- a cart that belongs to alice
        aliceCart = (await must("alice cart", api.post("/store/carts", { region_id: storefront.regionId, sales_channel_id: storefront.channelId }, alice.headers))).data.cart.id

        // --- two companies, each with a manager; an approval request in company 2
        const companies = container.resolve(COMPANY_MODULE) as any
        const link = container.resolve(ContainerRegistrationKeys.LINK) as any
        const makeManager = async (name: string, boss: TestCustomer) => {
          const company = await companies.createCompanies({ name, email: `${name}@companies.test` })
          const employee = await companies.createEmployees({ company_id: company.id, is_admin: true })
          await link.create({ [COMPANY_MODULE]: { employee_id: employee.id }, [Modules.CUSTOMER]: { customer_id: boss.customerId } })
        }
        await makeManager("company-one", boss1)
        await makeManager("company-two", boss2)

        const cart2 = (await must("boss2 cart", api.post("/store/carts", { region_id: storefront.regionId, sales_channel_id: storefront.channelId }, boss2.headers))).data.cart.id
        approvalOfCompany2 = (await (container.resolve(APPROVAL_MODULE) as any).createApprovals({ cart_id: cart2, created_by: boss2.customerId })).id
      })

      // ------------------------------------------------------------ orders
      it("an order belonging to a customer is read by that customer only", async () => {
        expect((await call(api.get(`/store/orders/${aliceOrder}`, anon))).status).toBe(404)
        expect((await call(api.get(`/store/orders/${aliceOrder}`, bob.headers))).status).toBe(404)
        const own = await call(api.get(`/store/orders/${aliceOrder}`, alice.headers))
        expect(own.status).toBe(200)
        expect(own.data.order.id).toBe(aliceOrder)
      })

      it("a guest order is reachable by its id (the confirmation page link)", async () => {
        const res = await call(api.get(`/store/orders/${guestOrder}`, anon))
        expect(res.status).toBe(200)
      })

      it("a seller's child order is never the buyer's, even though it has no customer", async () => {
        expect((await call(api.get(`/store/orders/${childOrder}`, anon))).status).toBe(404)
        expect((await call(api.get(`/store/orders/${childOrder}`, alice.headers))).status).toBe(404)
      })

      it("who ships what follows the same rule as the order", async () => {
        expect((await call(api.get(`/store/orders/${aliceOrder}/seller-orders`, anon))).status).toBe(404)
        expect((await call(api.get(`/store/orders/${aliceOrder}/seller-orders`, bob.headers))).status).toBe(404)
        expect((await call(api.get(`/store/orders/${aliceOrder}/seller-orders`, alice.headers))).status).toBe(200)
        expect((await call(api.get(`/store/orders/${guestOrder}/seller-orders`, anon))).status).toBe(200)
      })

      // ------------------------------------------------------------ quotes
      it("a quote belonging to a customer is read and acted on by that customer only", async () => {
        expect((await call(api.get(`/store/quotes/${aliceQuote}`, anon))).status).toBe(404)
        expect((await call(api.get(`/store/quotes/${aliceQuote}`, bob.headers))).status).toBe(404)
        expect((await call(api.get(`/store/quotes/${aliceQuote}`, alice.headers))).status).toBe(200)

        for (const who of [anon, bob.headers]) {
          expect((await call(api.post(`/store/quotes/${aliceQuote}/accept`, {}, who))).status).toBe(404)
          expect((await call(api.post(`/store/quotes/${aliceQuote}/reject`, {}, who))).status).toBe(404)
          expect((await call(api.post(`/store/quotes/${aliceQuote}/messages`, { text: "hi" }, who))).status).toBe(404)
        }
        // The signed-in routes too: another customer cannot take over a quote.
        expect((await call(api.post(`/store/customers/me/quotes/${aliceQuote}/accept`, {}, bob.headers))).status).toBe(404)
        expect((await call(api.post(`/store/customers/me/quotes/${aliceQuote}/messages`, { text: "hi" }, bob.headers))).status).toBe(404)

        const quotes = getContainer().resolve(QUOTE_MODULE) as any
        const after = await quotes.retrieveQuote(aliceQuote)
        expect(after.customer_id).toBe(alice.customerId)
        expect(after.status).toBe("pending_customer")
      })

      it("the owner can still message their own quote", async () => {
        const res = await call(api.post(`/store/quotes/${aliceQuote}/messages`, { text: "can you do better" }, alice.headers))
        expect(res.status).toBe(201)
      })

      it("a quote nobody owns yet (a guest's) is reachable by its id", async () => {
        expect((await call(api.get(`/store/quotes/${guestQuote}`, anon))).status).toBe(200)
      })

      it("a stranger's cart id does not list their quotes", async () => {
        const res = await call(api.get(`/store/quotes?cart_id=${aliceCart}`, anon))
        expect(res.status).toBe(200)
        expect((res.data.quotes ?? []).every((q: any) => !q.customer_id)).toBe(true)
      })

      it("a storefront caller can no longer mark a quote paid, dispatched or delivered", async () => {
        for (const action of ["pay", "dispatch", "deliver"]) {
          const res = await call(api.post(`/store/quotes/${aliceQuote}/${action}`, {}, alice.headers))
          expect([404, 405]).toContain(res.status)
        }
        const quotes = getContainer().resolve(QUOTE_MODULE) as any
        const quote = await quotes.retrieveQuote(aliceQuote)
        expect(quote.metadata?.payment_status).toBeUndefined()
      })

      // ------------------------------------------------------------- carts
      it("a customer's cart cannot be completed by someone else holding its id", async () => {
        expect((await call(api.post(`/store/carts/${aliceCart}/complete-all`, {}, anon))).status).toBe(404)
        expect((await call(api.post(`/store/carts/${aliceCart}/complete-all`, {}, bob.headers))).status).toBe(404)
        expect((await call(api.post(`/store/carts/${aliceCart}/complete-tickets`, {}, anon))).status).toBe(404)
        expect((await call(api.post(`/store/carts/${aliceCart}/complete-appointment`, {}, anon))).status).toBe(404)
        expect((await call(api.post(`/store/carts/${aliceCart}/complete-digital`, {}, anon))).status).toBe(404)
        expect((await call(api.post(`/store/rentals/${aliceCart}`, {}, anon))).status).toBe(404)
        expect((await call(api.post(`/store/eois/${aliceCart}`, {}, anon))).status).toBe(404)
        expect((await call(api.post("/store/deliveries", { cart_id: aliceCart, restaurant_id: "res_x" }, anon))).status).toBe(404)
      })

      it("submitting a cart for approval needs a signed-in owner", async () => {
        expect((await call(api.post(`/store/carts/${aliceCart}/submit-approval`, {}, anon))).status).toBe(401)
        expect((await call(api.post(`/store/carts/${aliceCart}/submit-approval`, {}, bob.headers))).status).toBe(404)
      })

      // --------------------------------------------------------- approvals
      it("a manager decides only their own company's spending requests", async () => {
        const wrong = await call(api.post("/store/approvals", { approval_id: approvalOfCompany2, status: "approved" }, boss1.headers))
        expect(wrong.status).toBe(404)

        const notManager = await call(api.post("/store/approvals", { approval_id: approvalOfCompany2, status: "approved" }, bob.headers))
        expect(notManager.status).toBe(403)

        const badStatus = await call(api.post("/store/approvals", { approval_id: approvalOfCompany2, status: "whatever" }, boss2.headers))
        expect(badStatus.status).toBe(400)

        const own = await call(api.post("/store/approvals", { approval_id: approvalOfCompany2, status: "approved" }, boss2.headers))
        expect(own.status).toBe(200)

        // And the list shows a manager only their own company's requests.
        const list1 = await call(api.get("/store/approvals", boss1.headers))
        expect(list1.data.approvals.map((a: any) => a.id)).not.toContain(approvalOfCompany2)
      })

      // --------------------------------------------------------- employees
      it("a new employee gets a random one-time password, never the old shared default", async () => {
        const res = await call(
          api.post("/store/customers/me/company/employees", { email: `new-${Date.now()}@staff.test`, first_name: "New" }, boss1.headers)
        )
        expect(res.status).toBe(201)
        expect(typeof res.data.temporary_password).toBe("string")
        expect(res.data.temporary_password).not.toBe("Password123!")
        expect(res.data.temporary_password.length).toBeGreaterThanOrEqual(12)

        const short = await call(api.post("/store/customers/me/company/employees", { email: "x@staff.test", password: "short" }, boss1.headers))
        expect(short.status).toBe(400)

        // Adding someone who already has an account does not touch their credentials.
        const existing = await call(api.post("/store/customers/me/company/employees", { email: bob.email }, boss1.headers))
        expect(existing.status).toBe(201)
        expect(existing.data.temporary_password).toBeUndefined()
        const stillBobs: any = await api.post("/auth/customer/emailpass", { email: bob.email, password: "supersecret-Test-1" })
        expect(stillBobs.data.token).toBeTruthy()
      })
    })
  },
})
