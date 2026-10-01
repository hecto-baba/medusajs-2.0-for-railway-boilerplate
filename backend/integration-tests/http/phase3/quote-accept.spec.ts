import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  createOrdersWorkflow,
} from "@medusajs/medusa/core-flows"
import { customerAcceptQuoteWorkflow } from "../../../src/workflows/customer-accept-quote"
import { QUOTE_MODULE } from "../../../src/modules/quote"
import { MARKETPLACE_MODULE } from "../../../src/modules/marketplace"
import { createTestVendor, TestVendor } from "../helpers/vendors"
import { setUpSeller, setUpStorefront, waitFor } from "../helpers/checkout"

jest.setTimeout(20 * 60 * 1000)

/**
 * Phase 3 step 6: an accepted quote becomes a real order but never went through
 * cart completion, so nothing announced it. The workflow now announces
 * order.placed, which gives each seller their order.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("accepting a quote places the order for the sellers", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let draftOrderId: string
      let quoteId: string

      const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY) as any
      const marketplace = () => getContainer().resolve(MARKETPLACE_MODULE) as any

      beforeAll(async () => {
        const container = getContainer()
        const storefront = await setUpStorefront(container)
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        const a = await setUpSeller(api, container, sellerA, "a", 100)
        const b = await setUpSeller(api, container, sellerB, "b", 50)

        // A draft order holding both sellers' products, as a quote's draft order does.
        const { result: draft } = await createOrdersWorkflow(container).run({
          input: {
            is_draft_order: true,
            status: "draft",
            currency_code: "usd",
            region_id: storefront.regionId,
            sales_channel_id: storefront.channelId,
            email: "buyer@test.local",
            shipping_address: { first_name: "B", last_name: "Uyer", address_1: "1 St", city: "Town", country_code: "us", postal_code: "10001" },
            items: [
              { title: "A item", quantity: 1, unit_price: 100, product_id: a.product, variant_id: a.variantId },
              { title: "B item", quantity: 1, unit_price: 50, product_id: b.product, variant_id: b.variantId },
            ],
          } as any,
        })
        draftOrderId = (draft as any).id

        const { result: change } = await beginOrderEditOrderWorkflow(container).run({
          input: { order_id: draftOrderId },
        })

        const quote = await (container.resolve(QUOTE_MODULE) as any).createQuotes({
          draft_order_id: draftOrderId,
          order_change_id: (change as any).id,
          status: "pending_customer",
        })
        quoteId = quote.id
      })

      it("before acceptance, no seller has the order", async () => {
        const rows = await marketplace().listVendorOrderSplits({ parent_order_id: draftOrderId })
        expect(rows).toHaveLength(0)
      })

      it("accepting the quote announces the order, and each seller gets their own", async () => {
        await customerAcceptQuoteWorkflow(getContainer()).run({ input: { quote_id: quoteId } })

        const splits = await waitFor(
          async () => marketplace().listVendorOrderSplits({ parent_order_id: draftOrderId }),
          (rows: any[]) => rows.length >= 2
        )
        expect(splits.map((s: any) => s.vendor_id).sort()).toEqual([sellerA.vendorId, sellerB.vendorId].sort())

        const { data: vendors } = await query().graph({
          entity: "vendor",
          fields: ["id", "orders.id"],
          filters: { id: [sellerA.vendorId, sellerB.vendorId] },
        })
        const childOf = (vendorId: string) => splits.find((s: any) => s.vendor_id === vendorId).child_order_id
        for (const vendor of vendors as any[]) {
          expect((vendor.orders ?? []).map((o: any) => o.id)).toContain(childOf(vendor.id))
          expect((vendor.orders ?? []).map((o: any) => o.id)).not.toContain(draftOrderId)
        }
      })
    })
  },
})
