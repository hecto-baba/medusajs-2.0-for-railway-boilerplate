import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../modules/appointment-booking"
import { disableStockTracking } from "../lib/service-stock"

/**
 * One-off backfill: switch stock tracking off for every variant of every product
 * that a resource offers as an appointment service. Such variants have no stock,
 * so Medusa refuses to add a booking for them to a cart.
 *
 * Safe to run any number of times: it only touches variants still tracking.
 * It lists what it would change and changes nothing unless told to.
 *
 *   pnpm medusa exec ./src/scripts/disable-stock-for-services.ts           (dry run)
 *   pnpm medusa exec ./src/scripts/disable-stock-for-services.ts apply      (do it)
 */
export default async function disableStockForServices({ container, args }: ExecArgs) {
  const apply = (args ?? []).some((a) => a === "apply" || a === "--apply")
  const appointments: any = container.resolve(APPOINTMENT_BOOKING_MODULE)
  const products: any = container.resolve(Modules.PRODUCT)

  const offerings = await appointments.listServiceProviders({}, { select: ["service_product_id"], take: null })
  const productIds = [...new Set<string>(offerings.map((o: any) => o.service_product_id))]
  console.log(`${productIds.length} product(s) are offered as services.`)

  const tracking = productIds.length
    ? await products.listProductVariants(
        { product_id: productIds, manage_inventory: true },
        { select: ["id", "title", "product_id"], take: null }
      )
    : []

  if (!tracking.length) {
    console.log("Every service variant already has stock tracking off. Nothing to do.")
    return
  }

  for (const v of tracking) {
    console.log(`  ${apply ? "switching off" : "would switch off"}: variant ${v.id} (${v.title}) of product ${v.product_id}`)
  }

  if (!apply) {
    console.log(`\nDry run: ${tracking.length} variant(s) would change. Re-run with "apply" to do it.`)
    return
  }

  const changed = await disableStockTracking(container, productIds)
  console.log(`\nDone: stock tracking switched off for ${changed} variant(s).`)
}
