import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  loadOfferings,
  replaceOfferings,
} from "../../../../../modules/appointment-booking/lib/resource-ops"
import {
  assertNoOtherSaleModeForProducts,
  withSaleModeLock,
} from "../../../../../lib/sale-mode"
import { disableStockTracking } from "../../../../../lib/service-stock"
import { assertVendorOwnsAll } from "../../../shared/vendor-scope"
import { assertResourceOwned, getAppointmentService } from "../../helpers"
import { PostServicesSchema } from "../../schemas"

/** The services (the seller's own products) this resource offers. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  res.json({
    services: await loadOfferings(req.scope, getAppointmentService(req), resource.id),
  })
}

/**
 * Sets the full list of services this resource offers. Every product must belong
 * to the calling vendor - checked for the whole list in one query. The update
 * itself is an idempotent diff (see replaceOfferings).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostServicesSchema>>,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)
  const services = req.validatedBody.services

  await assertVendorOwnsAll(
    req,
    "products",
    services.map((s) => s.product_id),
    "Product not found."
  )

  // One sale mode per product (e.g. not while enquiries are on). Check and
  // write share one lock so another mode cannot switch on between them.
  const productIds = services.map((s) => s.product_id)
  await withSaleModeLock(req.scope, productIds, async () => {
    await assertNoOtherSaleModeForProducts(req.scope, productIds, "appointment")
    await replaceOfferings(service, resource, services)
    // A service has no stock to count (see service-stock.ts).
    await disableStockTracking(req.scope, productIds)
  })

  res.json({ services: await loadOfferings(req.scope, service, resource.id) })
}
