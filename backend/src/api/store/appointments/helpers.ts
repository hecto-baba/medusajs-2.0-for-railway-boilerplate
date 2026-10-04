import type { MedusaRequest } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  QueryContext,
} from "@medusajs/framework/utils"
import { onboardingStore } from "../../../lib/onboarding-store"
import { APPOINTMENT_BOOKING_MODULE } from "../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../modules/appointment-booking/service"

export const getService = (req: MedusaRequest): AppointmentBookingModuleService =>
  req.scope.resolve(APPOINTMENT_BOOKING_MODULE)

const notFound = () => new MedusaError(MedusaError.Types.NOT_FOUND, "Not found.")

/**
 * Vendors whose store setup has been approved. Only these businesses are ever
 * shown to buyers - an unapproved vendor's resources are invisible and
 * unbookable even if the vendor has finished configuring them.
 *
 * Read straight from the database. The onboarding store keeps an in-memory copy
 * that is only loaded at start-up, so on a multi-instance deployment (or after an
 * approval made in another process) it can be stale; a buyer-facing list must
 * not be. The in-memory store is only a fallback if the table cannot be read.
 */
export const getApprovedVendorIds = async (req: MedusaRequest): Promise<Set<string>> => {
  try {
    const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const { rows } = await pg.raw(
      `select vendor_id from vendor_onboarding_application where status = 'APPROVED'`
    )
    return new Set<string>(rows.map((r: any) => r.vendor_id))
  } catch {
    await onboardingStore.ensureLoaded()
    return new Set(
      onboardingStore
        .listAll()
        .filter((record) => record.status === "APPROVED")
        .map((record) => record.vendorId)
    )
  }
}

/** Is this one vendor approved? A fresh read, and it never creates a record. */
export const isVendorApproved = async (
  req: MedusaRequest,
  vendorId: string
): Promise<boolean> => {
  try {
    const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const { rows } = await pg.raw(
      `select 1 from vendor_onboarding_application where vendor_id = ? and status = 'APPROVED' limit 1`,
      [vendorId]
    )
    return rows.length > 0
  } catch {
    return (await getApprovedVendorIds(req)).has(vendorId)
  }
}

/**
 * A resource a buyer may see and book: active, owned by an approved vendor.
 * Anything else answers 404 - the same as an id that does not exist.
 */
export const loadPublicResource = async (
  req: MedusaRequest,
  service: AppointmentBookingModuleService,
  resourceId: string
) => {
  const [resource] = await service.listProviders(
    { id: resourceId, status: "active" },
    { take: 1 }
  )
  if (!resource || !resource.vendor_id) throw notFound()

  if (!(await isVendorApproved(req, resource.vendor_id))) throw notFound()

  return resource as typeof resource & { vendor_id: string }
}

export type PricingContextInput = { region_id?: string; currency_code?: string }

/**
 * The variant's price in the buyer's region/currency, straight from Medusa's
 * pricing module, plus the product the variant belongs to. Used to show prices
 * to the buyer; the booking itself recomputes the price on the server.
 */
export const loadVariantPrice = async (
  req: MedusaRequest,
  variantId: string,
  pricing: PricingContextInput
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [variant],
  } = await query.graph({
    entity: "variant",
    fields: ["id", "title", "product_id", "product.status", "calculated_price.*"],
    filters: { id: variantId },
    context: {
      calculated_price: QueryContext({
        region_id: pricing.region_id,
        currency_code: pricing.currency_code,
      }),
    },
  })

  if (!variant || (variant as any).product?.status !== "published") {
    throw notFound()
  }

  const calculated = (variant as any).calculated_price
  return {
    variant_id: variant.id as string,
    product_id: variant.product_id as string,
    base_price: typeof calculated?.calculated_amount === "number" ? calculated.calculated_amount : null,
    currency_code: (calculated?.currency_code as string | undefined) ?? pricing.currency_code ?? null,
  }
}
