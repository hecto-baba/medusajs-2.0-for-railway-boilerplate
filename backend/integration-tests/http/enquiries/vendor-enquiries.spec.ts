import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import {
  createSellerProduct,
  must,
  setUpSeller,
  setUpStorefront,
  Storefront,
} from "../helpers/checkout"

jest.setTimeout(15 * 60 * 1000)

/**
 * docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_3.md, phases 1-4.
 *
 * - A seller sees and answers enquiries on THEIR products only; another
 *   seller's id answers 404, indistinguishable from "does not exist".
 * - An enquiry-enabled product cannot be added to a cart.
 * - A product uses one sale mode only (enquiry vs rental).
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("seller enquiries", () => {
      let sellerA: TestVendor
      let sellerB: TestVendor
      let sellerC: TestVendor // owns no products
      let storefront: Storefront
      let productA: string
      let variantA: string
      let productB: string
      let profileA: string

      const enable = (seller: TestVendor, productId: string, body: Record<string, unknown> = {}) =>
        call(
          api.post(
            `/vendors/products/${productId}/enquiry-config`,
            { status: "active", custom_fields: [], ...body },
            seller.headers
          )
        )

      // The store route is rate limited per client IP (5 per 10 minutes), keyed
      // on X-Forwarded-For. Every test enquiry comes from its own address so the
      // limiter does not interfere with what is being tested here.
      let clientCounter = 0
      const ask = async (productId: string, message = "Is this available in blue?") =>
        call(
          api.post(
            "/store/enquiries",
            { product_id: productId, customer_email: "buyer@test.local", message },
            {
              headers: {
                ...storefront.storeHeaders.headers,
                "x-forwarded-for": `10.0.0.${++clientCounter}`,
              },
            }
          )
        )

      beforeAll(async () => {
        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        sellerC = await createTestVendor(api, "c")
        storefront = await setUpStorefront(getContainer())

        const a = await setUpSeller(api, getContainer(), sellerA, "a", 10)
        profileA = a.profile
        productA = a.product
        variantA = a.variantId
        // Vendor products start as drafts; only published ones can be carted.
        await (getContainer().resolve(Modules.PRODUCT) as any).updateProducts(productA, {
          status: "published",
        })
        productB = (await setUpSeller(api, getContainer(), sellerB, "b", 10)).product
      })

      it("lets a seller enable enquiries on their own product", async () => {
        const res = await enable(sellerA, productA)
        expect(res.status).toBe(200)
        expect(res.data.enquiry_config.status).toBe("active")

        const read = await call(
          api.get(`/vendors/products/${productA}/enquiry-config`, sellerA.headers)
        )
        expect(read.status).toBe(200)
        expect(read.data.enquiry_config.status).toBe("active")
      })

      it("hides another seller's product config and enquiries (404)", async () => {
        await enable(sellerA, productA)

        const get = await call(
          api.get(`/vendors/products/${productA}/enquiry-config`, sellerB.headers)
        )
        const post = await enable(sellerB, productA)
        const list = await call(
          api.get(`/vendors/products/${productA}/enquiries`, sellerB.headers)
        )

        expect(get.status).toBe(404)
        expect(post.status).toBe(404)
        expect(list.status).toBe(404)
      })

      it("scopes the queue to the calling seller's own products", async () => {
        await enable(sellerA, productA)
        await must("enable B", enable(sellerB, productB))
        expect((await ask(productA, "for A")).status).toBe(201)
        expect((await ask(productB, "for B")).status).toBe(201)

        const queueA = await call(api.get("/vendors/enquiries", sellerA.headers))
        const queueB = await call(api.get("/vendors/enquiries", sellerB.headers))

        expect(queueA.data.count).toBe(1)
        expect(queueA.data.enquiries[0].message).toBe("for A")
        // The product title comes through the enquiry -> product link.
        expect(queueA.data.enquiries[0].product?.title).toBe("a product")
        expect(queueB.data.count).toBe(1)
        expect(queueB.data.enquiries[0].message).toBe("for B")
      })

      it("returns an empty queue (not everyone's) for a seller with no products", async () => {
        await enable(sellerA, productA)
        await ask(productA)

        const res = await call(api.get("/vendors/enquiries", sellerC.headers))

        expect(res.status).toBe(200)
        expect(res.data.count).toBe(0)
        expect(res.data.enquiries).toEqual([])
      })

      it("answers 404 with the same message for 'not yours' and 'does not exist'", async () => {
        await enable(sellerA, productA)
        const enquiryId = (await ask(productA)).data.enquiry.id

        const notYours = await call(api.get(`/vendors/enquiries/${enquiryId}`, sellerB.headers))
        const missing = await call(api.get("/vendors/enquiries/enq_does_not_exist", sellerB.headers))
        const replyNotYours = await call(
          api.post(`/vendors/enquiries/${enquiryId}`, { reply: "hi" }, sellerB.headers)
        )
        const closeNotYours = await call(
          api.post(`/vendors/enquiries/${enquiryId}/status`, { status: "closed" }, sellerB.headers)
        )

        expect(notYours.status).toBe(404)
        expect(missing.status).toBe(404)
        expect(notYours.data.message).toBe(missing.data.message)
        expect(replyNotYours.status).toBe(404)
        expect(closeNotYours.status).toBe(404)

        // ...and nothing was changed by the rejected attempts.
        const still = await call(api.get(`/vendors/enquiries/${enquiryId}`, sellerA.headers))
        expect(still.data.enquiry.status).toBe("pending")
      })

      it("lets the owner reply once, and rejects a second reply", async () => {
        await enable(sellerA, productA)
        const enquiryId = (await ask(productA)).data.enquiry.id

        const first = await call(
          api.post(`/vendors/enquiries/${enquiryId}`, { reply: "Yes, in blue." }, sellerA.headers)
        )
        expect(first.status).toBe(200)
        expect(first.data.enquiry.status).toBe("responded")

        const second = await call(
          api.post(`/vendors/enquiries/${enquiryId}`, { reply: "Changed my mind." }, sellerA.headers)
        )
        expect(second.status).toBeGreaterThanOrEqual(400)

        const read = await call(api.get(`/vendors/enquiries/${enquiryId}`, sellerA.headers))
        expect(read.data.enquiry.reply).toBe("Yes, in blue.")
      })

      it("lets the owner close an enquiry without replying", async () => {
        await enable(sellerA, productA)
        const enquiryId = (await ask(productA)).data.enquiry.id

        const res = await call(
          api.post(`/vendors/enquiries/${enquiryId}/status`, { status: "closed" }, sellerA.headers)
        )

        expect(res.status).toBe(200)
        expect(res.data.enquiry.status).toBe("closed")
      })

      it("refuses to add an enquiry-enabled product to a cart, and allows it again once off", async () => {
        const newCart = async () =>
          (
            await must(
              "cart",
              api.post(
                "/store/carts",
                { region_id: storefront.regionId, sales_channel_id: storefront.channelId },
                storefront.storeHeaders
              )
            )
          ).data.cart.id as string

        const addToCart = (cartId: string) =>
          call(
            api.post(
              `/store/carts/${cartId}/line-items`,
              { variant_id: variantA, quantity: 1 },
              storefront.storeHeaders
            )
          )

        // Control: purchasable before enquiries are enabled.
        const control = await addToCart(await newCart())
        if (control.status !== 200) {
          throw new Error(`control add-to-cart failed: ${JSON.stringify(control.data)}`)
        }

        await must("enable", enable(sellerA, productA))
        const blocked = await addToCart(await newCart())
        expect(blocked.status).toBeGreaterThanOrEqual(400)
        expect(JSON.stringify(blocked.data)).toMatch(/enquiry-only/i)

        await must("disable", enable(sellerA, productA, { status: "inactive" }))
        expect((await addToCart(await newCart())).status).toBe(200)
      })

      it("rejects enabling enquiries on a product that is rentable, and rental on an enquiry product", async () => {
        const rentable = (
          await createSellerProduct(api, sellerA, profileA, "Rentable thing", 10)
        ).id as string

        await must(
          "rental on",
          api.post(
            `/vendors/products/${rentable}/rental-config`,
            { status: "active" },
            sellerA.headers
          )
        )
        const enquiryOnRental = await enable(sellerA, rentable)
        expect(enquiryOnRental.status).toBeGreaterThanOrEqual(400)
        expect(JSON.stringify(enquiryOnRental.data)).toMatch(/one sale mode/i)

        // The other direction, on a product that already takes enquiries.
        await must("enquiry on", enable(sellerA, productA))
        const rentalOnEnquiry = await call(
          api.post(
            `/vendors/products/${productA}/rental-config`,
            { status: "active" },
            sellerA.headers
          )
        )
        expect(rentalOnEnquiry.status).toBeGreaterThanOrEqual(400)
        expect(JSON.stringify(rentalOnEnquiry.data)).toMatch(/one sale mode/i)
      })

      it("rejects enquiries on a product with an active Expression of Interest, and the reverse", async () => {
        const eoiProduct = await createSellerProduct(api, sellerA, profileA, "EOI thing", 10)
        const variantId = eoiProduct.variants[0].id as string
        const eoiUrl = `/vendors/products/${eoiProduct.id}/variants/${variantId}/eoi-config`

        await must(
          "eoi on",
          api.post(eoiUrl, { status: "active", value_type: "percentage", value_amount: 10 }, sellerA.headers)
        )
        const enquiryOnEoi = await enable(sellerA, eoiProduct.id)
        expect(enquiryOnEoi.status).toBeGreaterThanOrEqual(400)
        expect(JSON.stringify(enquiryOnEoi.data)).toMatch(/one sale mode/i)

        // Reverse: a product already taking enquiries cannot switch EOI on.
        await must("enquiry on", enable(sellerA, productA))
        const productAVariant = (
          await must("variants", api.get(`/vendors/products/${productA}/variants`, sellerA.headers))
        ).data.variants[0].id as string
        const eoiOnEnquiry = await call(
          api.post(
            `/vendors/products/${productA}/variants/${productAVariant}/eoi-config`,
            { status: "active", value_type: "percentage", value_amount: 10 },
            sellerA.headers
          )
        )
        expect(eoiOnEnquiry.status).toBeGreaterThanOrEqual(400)
        expect(JSON.stringify(eoiOnEnquiry.data)).toMatch(/one sale mode/i)
      })

      it("lets only one of two simultaneous, conflicting enables win (no product ends up in two modes)", async () => {
        const [enquiryRes, rentalRes] = await Promise.all([
          enable(sellerA, productA),
          call(
            api.post(
              `/vendors/products/${productA}/rental-config`,
              { status: "active" },
              sellerA.headers
            )
          ),
        ])

        const succeeded = [enquiryRes, rentalRes].filter((r) => r.status === 200)
        expect(succeeded).toHaveLength(1)

        // And the stored state agrees: exactly one mode is active.
        const enquiry = await call(
          api.get(`/vendors/products/${productA}/enquiry-config`, sellerA.headers)
        )
        const rental = await call(
          api.get(`/vendors/products/${productA}/rental-config`, sellerA.headers)
        )
        const enquiryOn = enquiry.data.enquiry_config?.status === "active"
        const rentalOn = rental.data.rental_config?.status === "active"
        expect(enquiryOn !== rentalOn).toBe(true)
      })

      it("rejects an oversized field list", async () => {
        const tooMany = Array.from({ length: 31 }, (_, i) => ({
          id: `f${i}`,
          type: "text",
          label: `Field ${i}`,
          required: false,
          order: i,
        }))
        const res = await enable(sellerA, productA, { custom_fields: tooMany })
        expect(res.status).toBe(400)

        const longLabel = await enable(sellerA, productA, {
          custom_fields: [
            { id: "x", type: "text", label: "L".repeat(201), required: false, order: 0 },
          ],
        })
        expect(longLabel.status).toBe(400)
      })

      it("lists a product's enquiries newest first", async () => {
        await enable(sellerA, productA)
        const one = await ask(productA, "first")
        await new Promise((resolve) => setTimeout(resolve, 20))
        const two = await ask(productA, "second")
        expect([one.status, two.status]).toEqual([201, 201])

        const res = await call(
          api.get(`/vendors/products/${productA}/enquiries`, sellerA.headers)
        )

        expect(res.data.enquiries.map((e: any) => e.message)).toEqual(["second", "first"])
      })

      it("resolves a product's seller name with one product query (used by the reply email)", async () => {
        const query: any = getContainer().resolve("query")
        const { data } = await query.graph({
          entity: "product",
          fields: ["id", "vendor.name"],
          filters: { id: productA },
        })

        expect(data[0].vendor.name).toBe(`Test Vendor ${sellerA.email.split("@")[0]}`)
      })
    })
  },
})
