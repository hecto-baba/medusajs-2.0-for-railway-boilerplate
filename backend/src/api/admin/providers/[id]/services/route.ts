import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
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
import { PostServicesSchema } from "../../../../vendors/resources/schemas"
import { getService, loadResource } from "../../helpers"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const resource = await loadResource(req, req.params.id)
  res.json({ services: await loadOfferings(req.scope, getService(req), resource.id) })
}

/**
 * Sets the services a resource offers. An admin may offer any product, so the
 * only check is that every product exists (one query for the whole list).
 */
export const POST = async (
  req: MedusaRequest<z.infer<typeof PostServicesSchema>>,
  res: MedusaResponse
) => {
  const resource = await loadResource(req, req.params.id)
  const service = getService(req)
  const services = req.validatedBody.services
  const ids = [...new Set(services.map((s) => s.product_id))]

  if (ids.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: { id: ids },
    })
    if (data.length !== ids.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found.")
    }
  }

  // One sale mode per product (e.g. not while enquiries are on). Check and
  // write share one lock so another mode cannot switch on between them.
  await withSaleModeLock(req.scope, ids, async () => {
    await assertNoOtherSaleModeForProducts(req.scope, ids, "appointment")
    await replaceOfferings(service, resource, services)
    // A service has no stock to count (see service-stock.ts).
    await disableStockTracking(req.scope, ids)
  })
  res.json({ services: await loadOfferings(req.scope, service, resource.id) })
}
