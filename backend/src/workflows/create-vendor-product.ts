import type { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createProductsWorkflow,
  type CreateProductsWorkflowInput,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorProductWorkflowInput = {
  vendor_admin_id: string
  product: CreateProductWorkflowInputDTO
}

/**
 * Creates a product and links it to the vendor behind the calling admin.
 *
 * The product is placed in the store's default sales channel: a vendor admin
 * has no way to pick one, and a product outside every sales channel is
 * invisible to the storefront.
 */
export const createVendorProductWorkflow = createWorkflow(
  "create-vendor-product",
  (input: CreateVendorProductWorkflowInput) => {
    const { data: stores } = useQueryGraphStep({
      entity: "store",
      fields: ["default_sales_channel_id"],
    }).config({ name: "retrieve-stores" })

    const { data: shippingProfiles } = useQueryGraphStep({
      entity: "shipping_profile",
      fields: ["id", "type"],
    }).config({ name: "retrieve-shipping-profiles" })

    const productData = transform({ input, stores, shippingProfiles }, (data) => {
      const defaultProfile =
        data.shippingProfiles?.find((sp: any) => sp.type === "default") ||
        data.shippingProfiles?.[0]

      return {
        products: [
          {
            ...data.input.product,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id:
              data.input.product.shipping_profile_id ?? defaultProfile?.id,
            sales_channels: [{ id: data.stores[0].default_sales_channel_id }],
          },
        ],
      }
    })

    const createdProducts = createProductsWorkflow.runAsStep({
      input: productData as CreateProductsWorkflowInput,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    // Build all remote links in a single transform and create them in one step.
    // createRemoteLinkStep is a named step ("create-remote-links") and Medusa's
    // workflow SDK does not allow the same step name to appear more than once
    // in a workflow — calling it twice would crash the server on startup.
    const linksToCreate = transform(
      { createdProducts, vendorAdmins, shippingProfiles },
      (data) => {
        const vendorId = data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link product: Authenticated vendor admin profile does not exist.")
        }

        const resolvedProfileId =
          data.shippingProfiles?.find((sp: any) => sp.type === "default")?.id ||
          data.shippingProfiles?.[0]?.id

        // vendor ↔ product links
        const vendorLinks = data.createdProducts.map((product) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: vendorId,
          },
          [Modules.PRODUCT]: {
            product_id: product.id,
          },
        }))

        // product ↔ shipping_profile links
        // Explicitly creating this link guarantees every vendor product has a
        // shipping profile in the link table. Without it Medusa rejects the
        // cart at checkout: "cart items require shipping profiles not satisfied
        // by current shipping methods".
        const shippingLinks = resolvedProfileId
          ? data.createdProducts.map((product) => ({
              [Modules.PRODUCT]: {
                product_id: product.id,
              },
              [Modules.FULFILLMENT]: {
                shipping_profile_id: resolvedProfileId,
              },
            }))
          : []

        return [...vendorLinks, ...shippingLinks]
      }
    )

    createRemoteLinkStep(linksToCreate)

    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: ["*", "variants.*"],
      filters: { id: createdProducts[0].id },
    }).config({ name: "retrieve-products" })

    return new WorkflowResponse({ product: products[0] })
  }
)
