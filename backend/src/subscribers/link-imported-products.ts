import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { linkImportedProductToVendor } from "../lib/link-imported-products"

/**
 * Links products created by a seller's CSV import back to that seller.
 *
 * See lib/link-imported-products.ts. A failure here is logged and swallowed: it
 * must never break product creation for any other flow, and an unlinked import
 * is visible in the logs and fixable by linking the product by hand.
 */
export default async function linkImportedProductsHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await linkImportedProductToVendor(container, data.id)
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error(
      `[link-imported-products] could not link product ${data?.id}:`,
      error?.message ?? error
    )
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
}
