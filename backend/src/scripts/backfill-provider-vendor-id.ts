import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../modules/appointment-booking"
import type AppointmentBookingModuleService from "../modules/appointment-booking/service"

/**
 * One-off: sets provider.vendor_id on resources created before multi-resource
 * support (they only know the staff login that created them).
 *
 *   npx medusa exec ./src/scripts/backfill-provider-vendor-id.ts
 *
 * Idempotent - rows that already have a vendor_id are skipped, so it is safe to
 * run twice. Rows whose login no longer resolves to a vendor are reported, not
 * guessed at. Uses two queries total (providers, then every needed login), plus
 * one batched update.
 */
export default async function backfillProviderVendorId({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const service: AppointmentBookingModuleService = container.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const providers = await service.listProviders(
    { vendor_id: null },
    { select: ["id", "vendor_admin_id"], take: null }
  )

  if (!providers.length) {
    logger.info("[backfill] nothing to do - every resource already has a vendor_id")
    return
  }

  const adminIds = [
    ...new Set(providers.map((p) => p.vendor_admin_id).filter((id): id is string => !!id)),
  ]

  const { data: admins } = adminIds.length
    ? await query.graph({
        entity: "vendor_admin",
        fields: ["id", "vendor.id"],
        filters: { id: adminIds },
      })
    : { data: [] as any[] }

  const vendorByAdmin = new Map<string, string>()
  for (const admin of admins as any[]) {
    if (admin?.vendor?.id) vendorByAdmin.set(admin.id, admin.vendor.id)
  }

  const updates: { id: string; vendor_id: string }[] = []
  const unresolved: string[] = []

  for (const provider of providers) {
    const vendorId = provider.vendor_admin_id
      ? vendorByAdmin.get(provider.vendor_admin_id)
      : undefined
    if (vendorId) updates.push({ id: provider.id, vendor_id: vendorId })
    else unresolved.push(provider.id)
  }

  if (updates.length) {
    await service.updateProviders(updates)
  }

  logger.info(`[backfill] set vendor_id on ${updates.length} resource(s)`)
  if (unresolved.length) {
    logger.warn(
      `[backfill] ${unresolved.length} resource(s) have no resolvable vendor and were left unchanged: ${unresolved.join(", ")}`
    )
  }
}
