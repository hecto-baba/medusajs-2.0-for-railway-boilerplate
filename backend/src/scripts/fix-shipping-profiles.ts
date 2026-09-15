import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/**
 * Backfills the product_shipping_profile link for every product that is
 * missing one. This happens when products are created via workflows that
 * pass `shipping_profile_id` as a plain field but the Medusa 2.x product
 * module stores the relationship in a separate link table instead.
 *
 * Run with:  npx medusa exec src/scripts/fix-shipping-profiles.ts
 */
export default async function fixShippingProfiles({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  logger.info("Looking up default shipping profile...")

  // Find the default shipping profile
  const allProfiles = await fulfillmentModuleService.listShippingProfiles({})
  const defaultProfile =
    allProfiles.find((sp) => sp.type === "default") || allProfiles[0]

  if (!defaultProfile) {
    logger.error("No shipping profile found. Run the seed script first.")
    return
  }

  logger.info(`Using shipping profile: "${defaultProfile.name}" (${defaultProfile.id})`)

  // Fetch all products with their current shipping_profile link
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "shipping_profile.id"],
  })

  const missing = products.filter(
    (p: any) => !p.shipping_profile || !p.shipping_profile?.id
  )

  if (missing.length === 0) {
    logger.info("All products already have a shipping profile. Nothing to do.")
    return
  }

  logger.info(`Found ${missing.length} products missing a shipping profile. Linking them now...`)

  const remoteLink = container.resolve(ContainerRegistrationKeys.LINK)

  let fixed = 0
  for (const product of missing) {
    try {
      await remoteLink.create({
        [Modules.PRODUCT]: {
          product_id: product.id,
        },
        [Modules.FULFILLMENT]: {
          shipping_profile_id: defaultProfile.id,
        },
      })
      logger.info(`  ✓ Linked "${product.title}" (${product.id})`)
      fixed++
    } catch (err: any) {
      logger.warn(`  ✗ Failed to link "${product.title}" (${product.id}): ${err.message}`)
    }
  }

  logger.info(`Done. Fixed ${fixed}/${missing.length} products.`)
}
