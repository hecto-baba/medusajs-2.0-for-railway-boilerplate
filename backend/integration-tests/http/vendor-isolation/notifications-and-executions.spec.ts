import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { Client } from "pg"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 14 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * Notifications: only those addressed to the seller (their admin id, email or
 * vendor id). Medusa core also sends platform-wide "feed" notifications meant
 * for the admin panel (for example "Product import completed", which names the
 * file); sellers must not receive them.
 *
 * Workflow executions: a seller sees an execution only when it was run for them,
 * meaning their id appears as the value of vendor_admin_id or vendor_id. The old
 * check matched their id ANYWHERE in the stored JSON, so another seller's
 * execution that merely mentioned their id was exposed.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer, dbConfig }) => {
    describe("seller isolation: notifications and workflow executions", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let adminA: string
      let adminB: string

      // Transaction ids stand in for the executions.
      const EXEC_A = "tx-owned-by-a"
      const EXEC_B = "tx-owned-by-b"
      const EXEC_B_MENTIONING_A = "tx-b-mentions-a"
      const EXEC_PLATFORM = "tx-platform"

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      const insertExecution = async (transactionId: string, context: unknown) => {
        const client = new Client({ connectionString: dbConfig.clientUrl })
        await client.connect()
        await client.query(
          "insert into workflow_execution (id, workflow_id, transaction_id, execution, context, state) values ($1, $2, $3, $4, $5, $6)",
          [`wfexec_${transactionId}`, "create-vendor-product", transactionId, JSON.stringify({ steps: {} }), JSON.stringify(context), "done"]
        )
        await client.end()
      }

      const executionIds = async (seller: TestVendor) => {
        const res = await call(api.get("/vendors/workflow-executions?limit=100", seller.headers))
        expect(res.status).toBe(200)
        return (res.data.workflow_executions ?? []).map((row: any) => row.transaction_id as string)
      }

      const notificationMarkers = async (seller: TestVendor) => {
        const res = await call(api.get("/vendors/notifications?limit=100", seller.headers))
        expect(res.status).toBe(200)
        return (res.data.notifications ?? []).map((n: any) => n?.data?.marker as string)
      }

      beforeAll(async () => {
        // The seller routes read workflow executions through their own database
        // pool, created on first use from DATABASE_URL: point it at the test database.
        process.env.DATABASE_URL = dbConfig.clientUrl

        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        adminA = (await must("me A", api.get("/vendors/me", sellerA.headers))).data.vendor_admin.id
        adminB = (await must("me B", api.get("/vendors/me", sellerB.headers))).data.vendor_admin.id

        await insertExecution(EXEC_A, { data: { invoke: { step: { vendor_admin_id: adminA } } } })
        await insertExecution(EXEC_B, { data: { invoke: { step: { vendor_admin_id: adminB } } } })
        // Seller B's execution that merely MENTIONS seller A's id, under a key that does not mean "run for A".
        await insertExecution(EXEC_B_MENTIONING_A, { data: { vendor_admin_id: adminB, note: adminA, customer_note: sellerA.vendorId } })
        await insertExecution(EXEC_PLATFORM, { data: { something: "else" } })

        const notifications = getContainer().resolve(Modules.NOTIFICATION) as any
        await notifications.createNotifications([
          { to: "someone-else@example.com", channel: "feed", template: "t", data: { marker: "to-someone-else" } },
          { to: "", channel: "feed", template: "admin-ui", data: { marker: "platform-broadcast" } },
          { to: sellerA.vendorId, channel: "feed", template: "t", data: { marker: "for-a" } },
          { to: sellerB.vendorId, channel: "feed", template: "t", data: { marker: "for-b" } },
        ])
      })

      describe("notifications", () => {
        it("a seller sees notifications addressed to them", async () => {
          expect(await notificationMarkers(sellerA)).toContain("for-a")
          expect(await notificationMarkers(sellerB)).toContain("for-b")
        })

        it("a seller never sees another seller's notifications", async () => {
          expect(await notificationMarkers(sellerA)).not.toContain("for-b")
          expect(await notificationMarkers(sellerB)).not.toContain("for-a")
        })

        it("a seller never sees notifications addressed to someone else", async () => {
          expect(await notificationMarkers(sellerA)).not.toContain("to-someone-else")
        })

        it("a seller never sees the platform's broadcast feed (admin panel notifications)", async () => {
          expect(await notificationMarkers(sellerA)).not.toContain("platform-broadcast")
        })
      })

      describe("workflow executions", () => {
        it("a seller sees the executions run for them", async () => {
          expect(await executionIds(sellerA)).toContain(EXEC_A)
          expect(await executionIds(sellerB)).toContain(EXEC_B)
        })

        it("a seller never sees another seller's execution or a platform one in the list", async () => {
          const ids = await executionIds(sellerA)
          expect(ids).not.toContain(EXEC_B)
          expect(ids).not.toContain(EXEC_PLATFORM)
        })

        it("an execution that only mentions a seller's id (under another key) is not theirs", async () => {
          expect(await executionIds(sellerA)).not.toContain(EXEC_B_MENTIONING_A)
        })

        it("the detail route answers 404 for another seller's, mentioning, and platform executions", async () => {
          expect((await call(api.get(`/vendors/workflow-executions/${EXEC_B}`, sellerA.headers))).status).toBe(404)
          expect((await call(api.get(`/vendors/workflow-executions/${EXEC_B_MENTIONING_A}`, sellerA.headers))).status).toBe(404)
          expect((await call(api.get(`/vendors/workflow-executions/${EXEC_PLATFORM}`, sellerA.headers))).status).toBe(404)
        })

        it("the detail route returns the seller's own execution", async () => {
          expect((await call(api.get(`/vendors/workflow-executions/${EXEC_A}`, sellerA.headers))).status).toBe(200)
        })
      })
    })
  },
})
