import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "./vendors"

/**
 * Reusable isolation suite for resources with the "own + shared platform"
 * rule (see src/api/vendors/shared/platform-scope.ts):
 *
 *   - a seller sees and uses its OWN rows plus shared PLATFORM rows (linked to
 *     no seller), and edits or deletes only its own;
 *   - another seller's row answers 404 on read, update and delete, and is
 *     never listed.
 *
 * IMPORTANT: call this from exactly ONE spec file per resource. The Medusa test
 * runner only keeps data created in the first describe block of a file, so two
 * resources in one file make the second one's setup disappear before its tests.
 */

export type PlatformResource = {
  label: string
  path: string
  listKey: string
  itemKey: string
  /** The field that carries the display name. */
  nameField: string
  create: (name: string) => Record<string, unknown>
  createPlatform: (container: any, name: string) => Promise<{ id: string }>
  retrieve: (container: any, id: string) => Promise<any>
}

export function registerPlatformResourceSuite(resource: PlatformResource) {
  jest.setTimeout(15 * 60 * 1000)

  medusaIntegrationTestRunner({
    inApp: true,
    testSuite: ({ api, getContainer }) => {
      describe(`seller isolation: ${resource.label}`, () => {
        let sellerA: TestVendor
        let sellerB: TestVendor
        let sellerWithNothing: TestVendor
        let idA: string
        let idB: string
        let platformId: string

        const container = () => getContainer()
        const ids = (res: { data: any }) => (res.data[resource.listKey] ?? []).map((r: any) => r.id)
        const url = (id: string) => `${resource.path}/${id}`

        beforeAll(async () => {
          sellerA = await createTestVendor(api, "a")
          sellerB = await createTestVendor(api, "b")
          sellerWithNothing = await createTestVendor(api, "empty")

          idA = (await api.post(resource.path, resource.create("A item"), sellerA.headers)).data[resource.itemKey].id
          idB = (await api.post(resource.path, resource.create("B item"), sellerB.headers)).data[resource.itemKey].id
          platformId = (await resource.createPlatform(container(), "Platform item")).id
        })

        it("a seller can read, update and delete their own row", async () => {
          expect((await call(api.get(url(idA), sellerA.headers))).status).toBe(200)

          const renamed = await call(
            api.post(url(idA), { [resource.nameField]: "A item renamed" }, sellerA.headers)
          )
          expect(renamed.status).toBe(200)

          const extra = await api.post(resource.path, resource.create("A throwaway"), sellerA.headers)
          const del = await call(api.delete(url(extra.data[resource.itemKey].id), sellerA.headers))
          expect(del.status).toBe(200)
        })

        it("another seller's row cannot be read (404)", async () => {
          expect((await call(api.get(url(idB), sellerA.headers))).status).toBe(404)
        })

        it("another seller's row cannot be renamed (404) and is unchanged", async () => {
          const res = await call(api.post(url(idB), { [resource.nameField]: "hijacked" }, sellerA.headers))
          expect(res.status).toBe(404)
          const stored = await resource.retrieve(container(), idB)
          expect(stored[resource.nameField]).toBe("B item")
        })

        it("another seller's row cannot be deleted (404) and still exists", async () => {
          expect((await call(api.delete(url(idB), sellerA.headers))).status).toBe(404)
          const stored = await resource.retrieve(container(), idB)
          expect(stored.id).toBe(idB)
        })

        it("a list shows the seller's own and platform rows, never another seller's", async () => {
          const res = await call(api.get(resource.path, sellerA.headers))
          expect(ids(res)).toContain(idA)
          expect(ids(res)).toContain(platformId)
          expect(ids(res)).not.toContain(idB)
        })

        it("a seller with none of their own sees platform rows but no other seller's", async () => {
          const res = await call(api.get(resource.path, sellerWithNothing.headers))
          expect(res.status).toBe(200)
          expect(ids(res)).toContain(platformId)
          expect(ids(res)).not.toContain(idA)
          expect(ids(res)).not.toContain(idB)
        })

        it("a platform row is readable but cannot be edited or deleted by a seller", async () => {
          expect((await call(api.get(url(platformId), sellerA.headers))).status).toBe(200)

          expect(
            (await call(api.post(url(platformId), { [resource.nameField]: "hijacked" }, sellerA.headers))).status
          ).toBe(404)
          expect((await call(api.delete(url(platformId), sellerA.headers))).status).toBe(404)

          const stored = await resource.retrieve(container(), platformId)
          expect(stored[resource.nameField]).toBe("Platform item")
        })
      })
    },
  })
}

/** Convenience for the common Fulfillment-module resources. */
export const fulfillmentModule = (container: any) => container.resolve(Modules.FULFILLMENT) as any
