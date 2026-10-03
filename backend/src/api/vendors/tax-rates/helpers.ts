import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

export const TAX_RATE_FIELDS = [
  "id",
  "name",
  "code",
  "rate",
  "is_default",
  "tax_region_id",
  "metadata",
  "created_at",
  "updated_at",
  "tax_region.id",
  "tax_region.country_code",
  "tax_region.province_code",
]

// Sellers never set rules or `is_default`: a seller rate always applies to the
// seller's own products and shipping options and nothing else.
export const CreateVendorTaxRateSchema = z
  .object({
    tax_region_id: z.string().min(1),
    name: z.string().min(1),
    code: z.string().optional(),
    rate: z.number().min(0).max(100),
  })
  .strict()

export const UpdateVendorOwnTaxRateSchema = z
  .object({
    name: z.string().min(1).optional(),
    code: z.string().optional(),
    rate: z.number().min(0).max(100).optional(),
  })
  .strict()

export const GetVendorTaxRatesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  tax_region_id: z.string().optional(),
})

export const refetchTaxRate = async (req: AuthenticatedMedusaRequest, id: string) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "tax_rate",
    fields: TAX_RATE_FIELDS,
    filters: { id },
  })
  return data?.[0]
}
