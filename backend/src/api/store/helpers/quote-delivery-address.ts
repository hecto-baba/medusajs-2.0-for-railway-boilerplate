import type { MedusaRequest } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

const FIELDS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "postal_code",
  "province",
  "country_code",
  "phone",
] as const

// Generous for any real address line; stops an oversized body being stored.
const MAX_LENGTH = 255

// What a delivery needs before anyone can send goods: who, where, which country.
const REQUIRED = ["first_name", "address_1", "city", "postal_code", "country_code"] as const

// `message` is set only when `ok` is false.
export type QuoteDeliveryAddressResult = { ok: boolean; message?: string }

/**
 * Makes sure an accepted quote that includes physical goods has somewhere to
 * deliver them.
 *
 * A quote is requested from the cart page, before checkout, so it usually
 * carries no address; and accepting it turns the draft order into an order
 * without ever passing through checkout. This is the one place the buyer can
 * still be asked, so accepting needs the address with it.
 *
 * A quote with nothing to ship (every line has requires_shipping false) needs
 * no address and is accepted exactly as before. A quote whose draft order
 * already has a street address keeps it. Only the address fields are read from
 * the request, so nothing else in the body can reach the order.
 */
export const ensureQuoteDeliveryAddress = async (
  req: MedusaRequest,
  draftOrderId: string | null | undefined,
  quoteStatus?: string | null
): Promise<QuoteDeliveryAddressResult> => {
  // An accepted quote is already an order: its address is no longer the
  // buyer's to rewrite through this route.
  if (!draftOrderId || quoteStatus === "accepted") {
    return { ok: true }
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "items.requires_shipping", "shipping_address.*"],
    filters: { id: draftOrderId },
  })

  const needsShipping = (order?.items ?? []).some(
    (item: any) => item?.requires_shipping !== false
  )
  if (!order || !needsShipping || order.shipping_address?.address_1) {
    return { ok: true }
  }

  const submitted = ((req.body as any)?.shipping_address ?? {}) as Record<
    string,
    unknown
  >
  const address: Record<string, string> = {}
  for (const field of FIELDS) {
    const value = submitted[field]
    if (typeof value === "string" && value.trim() !== "") {
      address[field] = value.trim().slice(0, MAX_LENGTH)
    }
  }
  if (address.country_code) {
    address.country_code = address.country_code.toLowerCase()
  }

  const missing = REQUIRED.filter((field) => !address[field])
  if (missing.length > 0) {
    return {
      ok: false,
      message: `A delivery address is needed to accept this quote (missing: ${missing.join(", ")}).`,
    }
  }
  if (!/^[a-z]{2}$/.test(address.country_code)) {
    return {
      ok: false,
      message: "A delivery address is needed to accept this quote (country must be a two-letter code, for example de).",
    }
  }

  // Not allowed to escape as a 500: the buyer is told what to do instead.
  try {
    const orderModuleService = req.scope.resolve(Modules.ORDER) as any
    await orderModuleService.updateOrders({
      id: draftOrderId,
      shipping_address: address,
    })
  } catch {
    return {
      ok: false,
      message: "Could not save the delivery address. Please try again.",
    }
  }

  return { ok: true }
}
