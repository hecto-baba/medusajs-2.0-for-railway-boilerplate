import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorTaxRateWorkflow } from "../../../workflows/create-vendor-tax-rate"
import { getOwnedIds } from "../shared/vendor-scope"
import {
  CreateVendorTaxRateSchema,
  GetVendorTaxRatesSchema,
  refetchTaxRate,
  TAX_RATE_FIELDS,
} from "./helpers"

export { CreateVendorTaxRateSchema, GetVendorTaxRatesSchema }

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, tax_region_id } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorTaxRatesSchema
  >

  // Only the seller's own rates. An empty list means "no constraint" downstream.
  const owned = await getOwnedIds(req, "tax_rates")
  if (!owned.length) {
    res.json({ tax_rates: [], count: 0, limit, offset })
    return
  }

  const { data: rates, metadata } = await query.graph({
    entity: "tax_rate",
    fields: TAX_RATE_FIELDS,
    filters: { id: owned, ...(tax_region_id ? { tax_region_id } : {}) },
    pagination: { skip: offset, take: limit, order: { created_at: "DESC" } },
  })

  res.json({ tax_rates: rates, count: metadata?.count ?? rates.length, limit, offset })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorTaxRateSchema>>,
  res: MedusaResponse
) => {
  const body = req.validatedBody
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // The region is platform-owned and shared; it only has to exist.
  const { data: regions } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
    filters: { id: body.tax_region_id },
  })
  if (!regions?.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Tax region not found.")
  }

  const { result } = await createVendorTaxRateWorkflow(req.scope).run({
    // Medusa requires a code on every rate; default it to the name.
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      tax_rate: { ...body, code: body.code ?? body.name },
    },
  })

  res.status(201).json({ tax_rate: await refetchTaxRate(req, result.tax_rate.id) })
}
