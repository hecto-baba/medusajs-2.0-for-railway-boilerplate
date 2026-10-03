import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 0, step 2 of docs/tenant-isolation-and-multi-tenancy.md: runtime checks
 * for the audit items that could not be settled by reading code.
 *
 * This is a PROBE, not a regression test: it records what the system does today
 * and prints a table. It does not fail on an insecure result. Each finding is
 * turned into a real failing-then-passing test in the Phase 1 step that fixes it.
 */
const findings: Record<string, string> = {}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("phase 0 runtime probe", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
      })

      afterAll(() => {
        // eslint-disable-next-line no-console
        console.log(
          "\n===== PHASE 0 RUNTIME PROBE RESULTS =====\n" +
            Object.entries(findings).map(([k, v]) => `${k}\n    -> ${v}`).join("\n") +
            "\n=========================================\n"
        )
      })

      it("1. do deep /vendors paths require authentication?", async () => {
        const probes: [string, string][] = [
          ["GET", "/vendors/layouts/x/configuration"],
          ["GET", "/vendors/products/prod_x/variants/variant_y/inventory-levels"],
          ["POST", "/vendors/price-lists/plist_x/prices/batch"],
          ["POST", "/vendors/shows/x/purchases/y/scan"],
          ["POST", "/vendors/products/imports/tx_x/confirm"],
          ["GET", "/vendors/taxonomy/segments"],
          ["GET", "/vendors/customers/cus_x/addresses/addr_y"],
          ["POST", "/vendors/inventory-items/iitem_x/location-levels/batch"],
          ["GET", "/vendors/stock-locations"],
        ]
        for (const [method, url] of probes) {
          const res = await call(
            method === "GET" ? api.get(url) : api.post(url, {})
          )
          findings[`unauthenticated ${method} ${url}`] =
            `HTTP ${res.status}` + (res.status === 401 ? " (protected)" : "  <-- NOT 401")
        }
      })

      it("2. does a seller-minted secret API key reach the admin API?", async () => {
        const created = await call(
          api.post("/vendors/api-keys", { title: "probe", type: "secret" }, sellerA.headers)
        )
        findings["seller can create type=secret key"] = `HTTP ${created.status}`

        const keyId = created.data?.api_key?.id
        let token: string | undefined = created.data?.api_key?.token
        findings["token in the create response"] = token ? `yes (${String(token).slice(0, 3)}..., length ${String(token).length})` : "no"

        // Where else could a usable token come from? The by-id read returns `token`.
        if (keyId) {
          const read = await call(api.get(`/vendors/api-keys/${keyId}`, sellerA.headers))
          const readToken = read.data?.api_key?.token
          findings["token from GET /vendors/api-keys/:id"] =
            readToken ? `present (${String(readToken).slice(0, 3)}..., length ${String(readToken).length}, redacted=${read.data?.api_key?.redacted})` : "absent"
          const list = await call(api.get("/vendors/api-keys", sellerA.headers))
          const listed = (list.data?.api_keys ?? []).find((k: any) => k.id === keyId)
          findings["token from GET /vendors/api-keys (list)"] =
            listed?.token ? `present (${String(listed.token).slice(0, 3)}..., length ${String(listed.token).length})` : "absent"
          token = token ?? readToken ?? listed?.token
        }

        for (const candidate of [token].filter(Boolean) as string[]) {
          const basic = Buffer.from(`${candidate}:`).toString("base64")
          const admin = await call(
            api.get("/admin/stock-locations", { headers: { authorization: `Basic ${basic}` } })
          )
          findings["that token used on GET /admin/stock-locations"] =
            `HTTP ${admin.status}` + (admin.status === 200 ? "  <-- ADMIN ACCESS GRANTED" : "")
        }
      })

      it("3. do feed / broadcast notifications reach every seller?", async () => {
        const notificationModule = getContainer().resolve(Modules.NOTIFICATION) as any
        try {
          await notificationModule.createNotifications({
            to: "someone-else@example.com",
            channel: "feed",
            template: "probe",
            data: { marker: "addressed-to-someone-else" },
          })
          const res = await call(api.get("/vendors/notifications", sellerB.headers))
          const leaked = (res.data?.notifications ?? []).some(
            (n: any) => n?.data?.marker === "addressed-to-someone-else"
          )
          findings["feed notification addressed to someone else shown to seller B"] =
            leaked ? "YES  <-- cross-seller leak" : "no"
        } catch (error: any) {
          findings["notification probe"] = `could not create a test notification: ${error.message}`
        }
      })

      it("4. do the layouts routes do anything?", async () => {
        const res = await call(api.get("/vendors/layouts/products/configuration", sellerA.headers))
        findings["GET /vendors/layouts/products/configuration (authenticated)"] =
          `HTTP ${res.status} ${JSON.stringify(res.data).slice(0, 120)}`
      })
    })
  },
})
