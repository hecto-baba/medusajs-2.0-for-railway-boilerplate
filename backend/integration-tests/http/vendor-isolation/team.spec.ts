import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 2 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A seller can only read, rename and remove members of their own team. Another
 * seller's admin must answer 404 and be left untouched.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api }) => {
    describe("seller isolation: team members", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let adminA: string
      let adminB: string

      const myAdminId = async (seller: TestVendor) => {
        const res = await call(api.get("/vendors/me", seller.headers))
        expect(res.status).toBe(200)
        return res.data.vendor_admin.id as string
      }

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        adminA = await myAdminId(sellerA)
        adminB = await myAdminId(sellerB)
      })

      it("a seller can read and rename a member of their own team", async () => {
        const read = await call(api.get(`/vendors/team/${adminA}`, sellerA.headers))
        expect(read.status).toBe(200)

        const renamed = await call(
          api.post(`/vendors/team/${adminA}`, { first_name: "Renamed" }, sellerA.headers)
        )
        expect({ status: renamed.status, body: renamed.status === 200 ? "ok" : renamed.data }).toEqual({
          status: 200,
          body: "ok",
        })
      })

      it("a seller's team list contains only their own team", async () => {
        const res = await call(api.get("/vendors/team", sellerA.headers))
        const ids = (res.data.members ?? res.data.team ?? res.data.vendor_admins ?? []).map((m: any) => m.id)
        expect(ids).toContain(adminA)
        expect(ids).not.toContain(adminB)
      })

      it("another seller's admin cannot be read (404)", async () => {
        const res = await call(api.get(`/vendors/team/${adminB}`, sellerA.headers))
        expect(res.status).toBe(404)
      })

      it("another seller's admin cannot be renamed (404) and is unchanged", async () => {
        const res = await call(
          api.post(`/vendors/team/${adminB}`, { first_name: "Hijacked" }, sellerA.headers)
        )
        expect(res.status).toBe(404)

        const owner = await call(api.get("/vendors/me", sellerB.headers))
        expect(owner.data.vendor_admin.first_name).not.toBe("Hijacked")
      })

      it("another seller's admin cannot be removed (404) and still exists", async () => {
        const res = await call(api.delete(`/vendors/team/${adminB}`, sellerA.headers))
        expect(res.status).toBe(404)

        const owner = await call(api.get("/vendors/me", sellerB.headers))
        expect(owner.status).toBe(200)
      })

      it("a seller still cannot remove themselves", async () => {
        const res = await call(api.delete(`/vendors/team/${adminA}`, sellerA.headers))
        expect(res.status).toBe(400)
      })
    })
  },
})
