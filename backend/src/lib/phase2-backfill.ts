import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  createShippingProfilesWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

/**
 * Phase 2, step 5: brings records created before Phase 2 up to the new model.
 *
 * Per seller, and only what is provable from the data:
 *  1. a seller with no shipping profile of their own gets one
 *  2. their products on a shared platform profile (or none) move to that profile,
 *     so the seller's own shipping options can serve them at checkout
 *  3. their stock locations with no fulfilment set get the full Phase 2.1 setup
 *
 * Reported but NEVER changed, because there is no evidence of who owns them:
 * products, inventory items and customers linked to no seller; sellers that
 * have products but no stock location; products on another seller's profile.
 *
 * Dry run by default: nothing is written unless { apply: true }. Safe to run
 * again: a second run finds nothing left to do.
 */

const DEFAULT_FULFILLMENT_PROVIDER_ID = "manual_manual"

export type BackfillReport = {
  applied: boolean
  sellers: number
  profilesToCreate: string[]
  productsToMove: Array<{ product_id: string; vendor_id: string }>
  locationsToProvision: Array<{ location_id: string; vendor_id: string; country_code: string | null }>
  needsAttention: {
    sellersWithProductsButNoLocation: string[]
    productsOnAnotherSellersProfile: Array<{ product_id: string; vendor_id: string }>
    unownedProducts: number
    unownedInventoryItems: number
    unownedCustomers: number
  }
}

export const runPhase2Backfill = async (
  container: MedusaContainer,
  options: { apply?: boolean } = {}
): Promise<BackfillReport> => {
  const apply = !!options.apply
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const link: any = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)

  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: [
      "id",
      "name",
      "products.id",
      "products.shipping_profile.id",
      "shipping_profiles.id",
      "shipping_profiles.type",
      "stock_locations.id",
      "stock_locations.name",
      "stock_locations.address.country_code",
      "stock_locations.fulfillment_sets.id",
      "stock_locations.fulfillment_sets.service_zones.shipping_options.id",
    ],
  })

  // Profiles claimed by any seller; everything else is a shared platform profile.
  const claimedProfiles = new Map<string, string>()
  for (const vendor of vendors as any[]) {
    for (const profile of vendor.shipping_profiles ?? []) {
      claimedProfiles.set(profile.id, vendor.id)
    }
  }

  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] })
  const defaultChannelId: string | undefined = store?.default_sales_channel_id

  const report: BackfillReport = {
    applied: apply,
    sellers: vendors.length,
    profilesToCreate: [],
    productsToMove: [],
    locationsToProvision: [],
    needsAttention: {
      sellersWithProductsButNoLocation: [],
      productsOnAnotherSellersProfile: [],
      unownedProducts: 0,
      unownedInventoryItems: 0,
      unownedCustomers: 0,
    },
  }

  for (const vendor of vendors as any[]) {
    const ownProfiles: any[] = vendor.shipping_profiles ?? []
    const products: any[] = vendor.products ?? []
    const locations: any[] = vendor.stock_locations ?? []

    // 1. A profile of their own.
    let ownProfileId: string | undefined = (
      ownProfiles.find((profile) => profile.type === "default") ?? ownProfiles[0]
    )?.id

    const needsProfile = products.length > 0 || locations.length > 0
    if (!ownProfileId && needsProfile) {
      report.profilesToCreate.push(vendor.id)
      if (apply) {
        const baseName = `${vendor.name ?? "Seller"} shipping`
        const clash = await fulfillment.listShippingProfiles({ name: baseName })
        const {
          result: [profile],
        } = await createShippingProfilesWorkflow(container).run({
          input: { data: [{ name: clash.length ? `${baseName} ${vendor.id}` : baseName, type: "default" }] },
        })
        await link.create({
          [MARKETPLACE_MODULE]: { vendor_id: vendor.id },
          [Modules.FULFILLMENT]: { shipping_profile_id: profile.id },
        })
        ownProfileId = profile.id
      }
    }

    // 2. Products on a shared profile (or none) move to the seller's own, but only for a
    // seller who already ships on their own (has a shipping option). Otherwise their
    // products stay on the platform profile so checkout keeps working; they move when
    // the seller creates their first option.
    const hasOwnOption = locations.some((location) =>
      (location.fulfillment_sets ?? []).some((set: any) =>
        (set.service_zones ?? []).some((zone: any) => (zone.shipping_options ?? []).length > 0)
      )
    )
    const ownIds = new Set(ownProfiles.map((profile) => profile.id))
    for (const product of products) {
      const current: string | undefined = product.shipping_profile?.id
      if (current && ownIds.has(current)) {
        continue
      }
      if (current && claimedProfiles.has(current)) {
        report.needsAttention.productsOnAnotherSellersProfile.push({ product_id: product.id, vendor_id: vendor.id })
        continue
      }
      if (!hasOwnOption) {
        continue
      }
      report.productsToMove.push({ product_id: product.id, vendor_id: vendor.id })
      if (apply && ownProfileId) {
        await updateProductsWorkflow(container).run({
          input: { selector: { id: product.id }, update: { shipping_profile_id: ownProfileId } },
        })
      }
    }

    // 3. Locations without a fulfilment set get the Phase 2.1 setup.
    if (products.length > 0 && locations.length === 0) {
      report.needsAttention.sellersWithProductsButNoLocation.push(vendor.id)
    }
    for (const location of locations) {
      if ((location.fulfillment_sets ?? []).length > 0) {
        continue
      }
      const countryCode: string | null = location.address?.country_code ?? null
      report.locationsToProvision.push({ location_id: location.id, vendor_id: vendor.id, country_code: countryCode })
      if (!apply) {
        continue
      }

      await createLocationFulfillmentSetWorkflow(container).run({
        input: {
          location_id: location.id,
          fulfillment_set_data: { name: `${location.name} shipping`, type: "shipping" },
        },
      })

      const { data: provisioned } = await query.graph({
        entity: "stock_location",
        fields: ["id", "fulfillment_sets.id"],
        filters: { id: location.id },
      })
      const setId = provisioned?.[0]?.fulfillment_sets?.[0]?.id
      if (setId && countryCode) {
        await createServiceZonesWorkflow(container).run({
          input: {
            data: [
              {
                name: `${location.name} zone`,
                fulfillment_set_id: setId,
                geo_zones: [{ type: "country", country_code: countryCode.toLowerCase() }],
              },
            ],
          },
        })
      }

      // The provider and channel links may already exist; creating them twice is harmless.
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: DEFAULT_FULFILLMENT_PROVIDER_ID },
      })
      if (defaultChannelId) {
        await linkSalesChannelsToStockLocationWorkflow(container).run({
          input: { id: location.id, add: [defaultChannelId] },
        })
      }
    }
  }

  // Report-only: records no seller owns. Not assigned without evidence of the owner.
  const countUnowned = async (entity: string, vendorField: string) => {
    const { data: all } = await query.graph({ entity, fields: ["id"] })
    const owned = new Set<string>()
    const { data: withOwners } = await query.graph({
      entity: "vendor",
      fields: [`${vendorField}.id`],
    })
    for (const vendor of withOwners as any[]) {
      for (const row of vendor[vendorField] ?? []) {
        owned.add(row.id)
      }
    }
    return (all as any[]).filter((row) => !owned.has(row.id)).length
  }

  report.needsAttention.unownedProducts = await countUnowned("product", "products")
  report.needsAttention.unownedInventoryItems = await countUnowned("inventory_item", "inventory_items")
  report.needsAttention.unownedCustomers = await countUnowned("customer", "customers")

  return report
}
