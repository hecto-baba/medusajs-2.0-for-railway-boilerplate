import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 1 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A seller must only be able to see and change their own API keys, must never
 * be able to touch a platform key (for example the storefront's publishable
 * key), and may only create publishable keys.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: API keys", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let keyA: string
      let keyB: string
      let platformKey: string

      const createKey = async (seller: TestVendor, title: string) => {
        const res = await call(
          api.post("/vendors/api-keys", { title, type: "publishable" }, seller.headers)
        )
        expect(res.status).toBe(201)
        return res.data.api_key.id as string
      }

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        keyA = await createKey(sellerA, "A key")
        keyB = await createKey(sellerB, "B key")

        // A key that belongs to the platform, not to any seller.
        const apiKeyModule = getContainer().resolve(Modules.API_KEY) as any
        const created = await apiKeyModule.createApiKeys({
          title: "Platform storefront key",
          type: "publishable",
          created_by: "platform",
        })
        platformKey = created.id
      })

      it("a seller can read, rename, revoke and delete their own key", async () => {
        // Assert on status AND body so a failure shows the server's message.
        const ok = (label: string, res: { status: number; data: any }) =>
          expect({ label, status: res.status, body: res.status === 200 ? "ok" : res.data }).toEqual({
            label,
            status: 200,
            body: "ok",
          })

        ok("read", await call(api.get(`/vendors/api-keys/${keyA}`, sellerA.headers)))

        const renamed = await call(
          api.post(`/vendors/api-keys/${keyA}`, { title: "A key renamed" }, sellerA.headers)
        )
        ok("rename", renamed)
        expect(renamed.data.api_key.title).toBe("A key renamed")

        const toRevoke = await createKey(sellerA, "A key to revoke")
        ok("revoke", await call(api.post(`/vendors/api-keys/${toRevoke}/revoke`, {}, sellerA.headers)))

        // Medusa only deletes a key that has been revoked first.
        const toDelete = await createKey(sellerA, "A key to delete")
        ok("revoke before delete", await call(api.post(`/vendors/api-keys/${toDelete}/revoke`, {}, sellerA.headers)))
        ok("delete", await call(api.delete(`/vendors/api-keys/${toDelete}`, sellerA.headers)))
      })

      it("a seller's list contains only their own keys", async () => {
        const res = await call(api.get("/vendors/api-keys", sellerA.headers))
        const ids = (res.data.api_keys ?? []).map((k: any) => k.id)
        expect(ids).toContain(keyA)
        expect(ids).not.toContain(keyB)
        expect(ids).not.toContain(platformKey)
      })

      describe.each([
        ["another seller's key", () => keyB],
        ["a platform key", () => platformKey],
      ])("%s", (_label, getId) => {
        it("cannot be read (404)", async () => {
          const res = await call(api.get(`/vendors/api-keys/${getId()}`, sellerA.headers))
          expect(res.status).toBe(404)
        })

        it("cannot be renamed (404) and stays unchanged", async () => {
          const res = await call(
            api.post(`/vendors/api-keys/${getId()}`, { title: "hijacked" }, sellerA.headers)
          )
          expect(res.status).toBe(404)

          const stored: any = await (getContainer().resolve(Modules.API_KEY) as any).retrieveApiKey(getId())
          expect(stored.title).not.toBe("hijacked")
        })

        it("cannot be revoked (404) and stays active", async () => {
          const res = await call(api.post(`/vendors/api-keys/${getId()}/revoke`, {}, sellerA.headers))
          expect(res.status).toBe(404)

          const stored: any = await (getContainer().resolve(Modules.API_KEY) as any).retrieveApiKey(getId())
          expect(stored.revoked_at).toBeFalsy()
        })

        it("cannot be deleted (404) and still exists", async () => {
          const res = await call(api.delete(`/vendors/api-keys/${getId()}`, sellerA.headers))
          expect(res.status).toBe(404)

          const stored: any = await (getContainer().resolve(Modules.API_KEY) as any).retrieveApiKey(getId())
          expect(stored.id).toBe(getId())
        })
      })

      it("a seller cannot create a secret key", async () => {
        const res = await call(
          api.post("/vendors/api-keys", { title: "nope", type: "secret" }, sellerA.headers)
        )
        expect(res.status).toBe(400)
      })
    })
  },
})
