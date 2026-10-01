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

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id", "vendor.shipping_profiles.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    // Every seller's profiles, to tell shared platform profiles (owned by no
    // seller) apart from another seller's profile.
    const { data: allVendors } = useQueryGraphStep({
      entity: "vendor",
      fields: ["id", "shipping_profiles.id"],
    }).config({ name: "retrieve-vendors-for-shipping-profile-scope" })

    // The shipping profile for this product: the one requested if the seller may
    // use it, otherwise the seller's own default, then any own profile, then
    // the shared platform default. Never another seller's profile.
    const resolvedProfileId = transform(
      { input, shippingProfiles, vendorAdmins, allVendors },
      (data) => {
        const ownedIds = new Set<string>(
          (data.vendorAdmins?.[0]?.vendor?.shipping_profiles ?? [])
            .map((profile: any) => profile?.id)
            .filter(Boolean)
        )
        const claimedIds = new Set<string>(
          (data.allVendors ?? []).flatMap((vendor: any) =>
            (vendor?.shipping_profiles ?? [])
              .map((profile: any) => profile?.id)
              .filter(Boolean)
          )
        )
        const visible = (data.shippingProfiles ?? []).filter(
          (profile: any) => ownedIds.has(profile.id) || !claimedIds.has(profile.id)
        )

        const requested = data.input.product.shipping_profile_id
        if (requested) {
          if (!visible.some((profile: any) => profile.id === requested)) {
            throw new Error("Shipping profile not found.")
          }
          return requested as string
        }

        const own = visible.filter((profile: any) => ownedIds.has(profile.id))
        const chosen =
          own.find((profile: any) => profile.type === "default") ||
          own[0] ||
          visible.find((profile: any) => profile.type === "default") ||
          visible[0]

        return chosen?.id as string | undefined
      }
    )

    const productData = transform({ input, stores, resolvedProfileId }, (data) => ({
      products: [
        {
          ...data.input.product,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: data.resolvedProfileId,
          sales_channels: [{ id: data.stores[0].default_sales_channel_id }],
        },
      ],
    }))

    const createdProducts = createProductsWorkflow.runAsStep({
      input: productData as CreateProductsWorkflowInput,
    })

    // Build all remote links in a single transform and create them in one step.
    // createRemoteLinkStep is a named step ("create-remote-links") and Medusa's
    // workflow SDK does not allow the same step name to appear more than once
    // in a workflow — calling it twice would crash the server on startup.
    const linksToCreate = transform(
      { createdProducts, vendorAdmins, resolvedProfileId },
      (data) => {
        const vendorId = data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link product: Authenticated vendor admin profile does not exist.")
        }

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
        const shippingLinks = data.resolvedProfileId
          ? data.createdProducts.map((product) => ({
              [Modules.PRODUCT]: {
                product_id: product.id,
              },
              [Modules.FULFILLMENT]: {
                shipping_profile_id: data.resolvedProfileId,
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
