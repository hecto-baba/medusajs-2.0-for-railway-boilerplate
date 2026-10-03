import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, TransactionHandlerType } from "@medusajs/framework/utils"
import {
  importProductsAsChunksWorkflowId,
  waitConfirmationProductImportStepId,
} from "@medusajs/medusa/core-flows"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import { linkImportedProductToVendor } from "../../../src/lib/link-imported-products"

jest.setTimeout(15 * 60 * 1000)

/**
 * Phase 1, step 12 of docs/tenant-isolation-and-multi-tenancy.md.
 *
 * A CSV product import runs in a background step with no request, so everything
 * that can be checked must be checked BEFORE it starts, and the import must be
 * remembered so that only its owner can confirm it and so that the products it
 * creates are linked back to the owner.
 *
 * Test notes: an import that is started but never confirmed stays "waiting" in
 * the workflow engine, and the test runner waits for every workflow to finish
 * before it tears down. So every import a test starts is abandoned after the
 * test (see abandonPending). Data created inside a test is rolled back after it,
 * so each test starts its own import.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller isolation: product imports", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let productA: string
      let productB: string
      let typeB: string
      let fileForeignId: string
      let fileQuotedComma: string
      let fileOwnUpdate: string
      let fileUnsupported: string
      let fileForeignType: string
      let fileForeignTag: string

      const fileModule = () => getContainer().resolve(Modules.FILE) as any
      const uploaded: string[] = []
      const pending: string[] = []

      const productBody = (title: string) => ({
        title,
        options: [{ title: "Size", values: ["M"] }],
        variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: 10 }], manage_inventory: false }],
      })

      const must = async (label: string, request: Promise<any>) => {
        const res = await call(request)
        if (res.status >= 400) {
          throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
        }
        return res
      }

      /** Stores a CSV and returns its file key (the id the import route takes). */
      const storeCsv = async (name: string, csv: string): Promise<string> => {
        const file = await fileModule().createFiles({
          filename: `${name}.csv`,
          mimeType: "text/csv",
          content: Buffer.from(csv).toString("binary"),
          access: "private",
        })
        uploaded.push(file.id)
        return file.id
      }

      /** Starts an import; remembers it so it can be abandoned after the test. */
      const startImport = async (seller: TestVendor, fileKey: string) => {
        const res = await call(
          api.post(
            "/vendors/products/imports",
            { file_key: fileKey, originalname: "products.csv", extension: "csv", size: 100, mime_type: "text/csv" },
            seller.headers
          )
        )
        if (res.status === 202 && res.data?.transaction_id) {
          pending.push(res.data.transaction_id)
        }
        return res
      }

      /** Fails the "wait for confirmation" step of every import still waiting, so the workflow can end. */
      const abandonPending = async () => {
        const engine = getContainer().resolve(Modules.WORKFLOW_ENGINE) as any
        for (const transactionId of pending.splice(0)) {
          try {
            await engine.setStepFailure({
              idempotencyKey: {
                action: TransactionHandlerType.INVOKE,
                transactionId,
                stepId: waitConfirmationProductImportStepId,
                workflowId: importProductsAsChunksWorkflowId,
              },
              stepResponse: { message: "abandoned by test" } as any,
            })
          } catch {
            // already finished or confirmed: nothing to abandon
          }
        }
      }

      const productCount = async () => {
        const query: any = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({ entity: "product", fields: ["id"] })
        return data.length as number
      }

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")

        productA = (await must("product A", api.post("/vendors/products", productBody("A product"), sellerA.headers))).data.product.id
        productB = (await must("product B", api.post("/vendors/products", productBody("B product"), sellerB.headers))).data.product.id
        typeB = (await must("type B", api.post("/vendors/product-types", { value: "B type" }, sellerB.headers))).data.product_type.id
        await must("tag B", api.post("/vendors/product-tags", { value: "b-tag" }, sellerB.headers))

        fileForeignId = await storeCsv("foreign-id", ["Product Id,Product Handle,Product Title", `${productB},b-product,Hijacked`].join("\n"))
        // The old check split on commas, so a quoted comma shifted the columns and hid the Product Id.
        fileQuotedComma = await storeCsv(
          "quoted-comma",
          ["Product Title,Product Id,Product Handle", `"Shirt, large",${productB},b-product`].join("\n")
        )
        fileOwnUpdate = await storeCsv(
          "own-update",
          ["Product Id,Product Handle,Product Title,Variant Title", `${productA},a-product,Renamed by import,Default`].join("\n")
        )
        fileUnsupported = await storeCsv("unsupported", ["Product Handle,Product Mystery Id", "mystery,abc"].join("\n"))
        fileForeignType = await storeCsv("foreign-type", ["Product Handle,Product Title,Product Type Id", `typed,Typed,${typeB}`].join("\n"))
        fileForeignTag = await storeCsv("foreign-tag", ["Product Handle,Product Title,Product Tag 1", "tagged,Tagged,b-tag"].join("\n"))
      })

      afterEach(abandonPending)

      afterAll(async () => {
        try {
          await fileModule().deleteFiles(uploaded)
        } catch {
          // best effort: the files are throwaway test data
        }
      })

      describe("what a CSV may reference", () => {
        it("a CSV naming another seller's product id is refused (404) before anything starts", async () => {
          const before = await productCount()
          expect((await startImport(sellerA, fileForeignId)).status).toBe(404)
          expect(await productCount()).toBe(before)
        })

        it("a quoted comma cannot hide another seller's product id (404)", async () => {
          expect((await startImport(sellerA, fileQuotedComma)).status).toBe(404)
        })

        it("a CSV naming another seller's product type is refused (404)", async () => {
          expect((await startImport(sellerA, fileForeignType)).status).toBe(404)
        })

        it("a CSV naming another seller's tag by value is refused (404)", async () => {
          expect((await startImport(sellerA, fileForeignTag)).status).toBe(404)
        })

        it("a CSV with an id column that cannot be checked is refused (400)", async () => {
          expect((await startImport(sellerA, fileUnsupported)).status).toBe(400)
        })

        it("a CSV updating the seller's own product is accepted (202) and recorded", async () => {
          const res = await startImport(sellerA, fileOwnUpdate)
          expect({ status: res.status, body: res.status === 202 ? "ok" : res.data }).toEqual({ status: 202, body: "ok" })
          expect(typeof res.data.transaction_id).toBe("string")
        })
      })

      describe("who may confirm an import", () => {
        const newImport = async (name: string, handle: string) =>
          startImport(sellerA, await storeCsv(name, ["Product Handle,Product Title,Variant Title", `${handle},Imported,Default`].join("\n")))

        it("another seller cannot confirm the import (404)", async () => {
          const started = await newImport("confirm-1", "confirm-handle-1")
          expect(started.status).toBe(202)
          const res = await call(api.post(`/vendors/products/imports/${started.data.transaction_id}/confirm`, {}, sellerB.headers))
          expect(res.status).toBe(404)
        })

        it("the legacy alias route is protected the same way (404)", async () => {
          const started = await newImport("confirm-2", "confirm-handle-2")
          expect(started.status).toBe(202)
          const res = await call(api.post(`/vendors/products/import/${started.data.transaction_id}/confirm`, {}, sellerB.headers))
          expect(res.status).toBe(404)
        })

        it("an unknown transaction id answers 404", async () => {
          const res = await call(api.post("/vendors/products/imports/does-not-exist/confirm", {}, sellerA.headers))
          expect(res.status).toBe(404)
        })

        it("the seller who started it can confirm it (202)", async () => {
          const started = await newImport("confirm-3", "confirm-handle-3")
          expect(started.status).toBe(202)
          const res = await call(api.post(`/vendors/products/imports/${started.data.transaction_id}/confirm`, {}, sellerA.headers))
          expect({ status: res.status, body: res.status === 202 ? "ok" : res.data }).toEqual({ status: 202, body: "ok" })
        })
      })

      describe("files and handles", () => {
        it("another seller cannot import the same uploaded file (404)", async () => {
          const file = await storeCsv("shared-file", ["Product Handle,Product Title,Variant Title", "shared-file-handle,Shared,Default"].join("\n"))
          expect((await startImport(sellerA, file)).status).toBe(202)
          expect((await startImport(sellerB, file)).status).toBe(404)
        })

        it("two sellers cannot hold the same product handle in active imports (400)", async () => {
          const a = await storeCsv("handle-a", ["Product Handle,Product Title,Variant Title", "same-handle,Shared,Default"].join("\n"))
          const b = await storeCsv("handle-b", ["Product Handle,Product Title,Variant Title", "same-handle,Other,Default"].join("\n"))
          expect((await startImport(sellerA, a)).status).toBe(202)
          expect((await startImport(sellerB, b)).status).toBe(400)
        })
      })

      describe("linking imported products to their seller", () => {
        it("a product created by the seller's import is linked to that seller", async () => {
          const file = await storeCsv("link-me", ["Product Handle,Product Title,Variant Title", "imported-shirt,Imported,Default"].join("\n"))
          expect((await startImport(sellerA, file)).status).toBe(202)

          // What the importer does in the background: create the product, unlinked.
          const productModule = getContainer().resolve(Modules.PRODUCT) as any
          const created = await productModule.createProducts({ title: "Imported", handle: "imported-shirt" })

          expect(await linkImportedProductToVendor(getContainer(), created.id)).toBe(sellerA.vendorId)

          expect((await call(api.get(`/vendors/products/${created.id}`, sellerA.headers))).status).toBe(200)
          expect((await call(api.get(`/vendors/products/${created.id}`, sellerB.headers))).status).toBe(404)
        })

        it("a product whose handle is in no import is left alone", async () => {
          const productModule = getContainer().resolve(Modules.PRODUCT) as any
          const created = await productModule.createProducts({ title: "Plain", handle: "plain-product" })
          expect(await linkImportedProductToVendor(getContainer(), created.id)).toBeNull()
        })

        it("a product already linked to a seller is never taken over", async () => {
          const file = await storeCsv("steal-me", ["Product Handle,Product Title,Variant Title", "owned-by-b,Owned,Default"].join("\n"))
          expect((await startImport(sellerA, file)).status).toBe(202)

          // Seller B already owns a product with that handle (e.g. created normally).
          const created = (await must("owned by B", api.post("/vendors/products", { ...productBody("Owned by B"), handle: "owned-by-b" }, sellerB.headers)))
            .data.product
          expect(await linkImportedProductToVendor(getContainer(), created.id)).toBeNull()
          expect((await call(api.get(`/vendors/products/${created.id}`, sellerB.headers))).status).toBe(200)
        })
      })
    })
  },
})
