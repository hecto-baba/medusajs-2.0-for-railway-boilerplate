import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * When a seller starts shipping on their own (their FIRST shipping option), move
 * their products from the shared platform shipping profile onto their own.
 *
 * Why: Medusa keeps one shipping method per shipping profile, so each seller needs
 * their own profile for a two-seller cart to hold two methods. But a seller's
 * options only ship products on their own profile. Until the seller has an option,
 * their products stay on the platform profile, so checkout keeps working with the
 * platform's shipping (a seller with no shipping set up is never a dead end).
 *
 * Products already on one of the seller's own profiles, or on another seller's
 * profile, are left alone. Returns how many products moved.
 */
export const adoptOwnShippingProfile = async (
  container: MedusaContainer,
  vendorId: string,
  ownProfileId: string
): Promise<number> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: ["id", "products.id", "products.shipping_profile.id", "shipping_profiles.id"],
  })

  // A profile some seller owns is not the shared platform profile.
  const claimed = new Set<string>()
  for (const vendor of vendors as any[]) {
    for (const profile of vendor.shipping_profiles ?? []) {
      claimed.add(profile.id)
    }
  }

  const me = (vendors as any[]).find((vendor) => vendor.id === vendorId)
  const toMove = ((me?.products ?? []) as any[]).filter((product) => {
    const current: string | undefined = product.shipping_profile?.id
    return !current || !claimed.has(current)
  })

  for (const product of toMove) {
    await updateProductsWorkflow(container).run({
      input: { selector: { id: product.id }, update: { shipping_profile_id: ownProfileId } },
    })
  }

  return toMove.length
}

/** True when the seller has at least one shipping option under one of their own locations. */
export const sellerHasShippingOption = async (
  container: MedusaContainer,
  vendorId: string
): Promise<boolean> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [vendor],
  } = await query.graph({
    entity: "vendor",
    fields: ["id", "stock_locations.fulfillment_sets.service_zones.shipping_options.id"],
    filters: { id: [vendorId] },
  })

  return ((vendor?.stock_locations ?? []) as any[]).some((location) =>
    (location.fulfillment_sets ?? []).some((set: any) =>
      (set.service_zones ?? []).some((zone: any) => (zone.shipping_options ?? []).length > 0)
    )
  )
}
