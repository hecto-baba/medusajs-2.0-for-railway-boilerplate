import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * One-off backfill: switch stock tracking off for every variant of every
 * restaurant dish. Dishes are made to order and have no stock, so with tracking
 * on, Medusa refuses to add them to a cart ("Sales channel ... is not
 * associated with any stock location for variant ...").
 *
 * New dishes already get manage_inventory: false from
 * createRestaurantProductsWorkflow; this fixes the ones created before that.
 *
 * Safe to run any number of times: it only touches variants still tracking, and
 * only variants of products linked to a restaurant. It lists what it would
 * change and changes nothing unless told to.
 *
 *   pnpm medusa exec ./src/scripts/disable-stock-for-restaurant-dishes.ts           (dry run)
 *   pnpm medusa exec ./src/scripts/disable-stock-for-restaurant-dishes.ts apply      (do it)
 */
export default async function disableStockForRestaurantDishes({ container, args }: ExecArgs) {
  const apply = (args ?? []).some((a) => a === "apply" || a === "--apply")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const products: any = container.resolve(Modules.PRODUCT)

  const { data: restaurants } = await query.graph({
    entity: "restaurant",
    fields: ["id", "name", "products.id"],
  })
  const productIds = [
    ...new Set<string>(
      restaurants.flatMap((r: any) => (r.products ?? []).map((p: any) => p.id))
    ),
  ]
  console.log(`${productIds.length} dish(es) across ${restaurants.length} restaurant(s).`)

  const tracking = productIds.length
    ? await products.listProductVariants(
        { product_id: productIds, manage_inventory: true },
        { select: ["id", "title", "product_id"], take: null }
      )
    : []

  if (!tracking.length) {
    console.log("Every dish variant already has stock tracking off. Nothing to do.")
    return
  }

  for (const v of tracking) {
    console.log(`  ${apply ? "switching off" : "would switch off"}: variant ${v.id} (${v.title}) of product ${v.product_id}`)
  }

  if (!apply) {
    console.log(`\nDry run: ${tracking.length} variant(s) would change. Re-run with "apply" to do it.`)
    return
  }

  await products.updateProductVariants(
    { id: tracking.map((v: { id: string }) => v.id) },
    { manage_inventory: false }
  )
  console.log(`\nDone: stock tracking switched off for ${tracking.length} variant(s).`)
}
