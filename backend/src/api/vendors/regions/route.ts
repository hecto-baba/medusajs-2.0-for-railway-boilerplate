import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createRegionsWorkflow } from "@medusajs/medusa/core-flows"

export const GetVendorRegionsSchema = z.object({
  q: z.string().optional(),
  currency_code: z.string().optional(),
  order: z.string().optional(),
})

export const CreateVendorRegionSchema = z.object({
  name: z.string().min(1),
  currency_code: z.string().min(2),
  countries: z.array(z.string()).min(1),
  payment_providers: z.array(z.string()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { q, currency_code, order } = (req.validatedQuery ?? {}) as z.infer<
    typeof GetVendorRegionsSchema
  >

  const filters: Record<string, any> = {}
  if (currency_code) {
    filters.currency_code = currency_code.toLowerCase()
  }
  if (q) {
    filters.$or = [
      { name: { $ilike: `%${q}%` } },
      { currency_code: { $ilike: `%${q}%` } },
    ]
  }

  let orderObj: Record<string, "ASC" | "DESC"> = { name: "ASC" }
  if (order) {
    const isDesc = order.startsWith("-")
    const field = isDesc ? order.slice(1) : order
    orderObj = { [field]: isDesc ? "DESC" : "ASC" }
  }

  const { data: regions } = await query.graph({
    entity: "region",
    fields: [
      "id",
      "name",
      "currency_code",
      "countries.iso_2",
      "countries.display_name",
      "payment_providers.id",
      "created_at",
      "updated_at",
    ],
    filters,
    pagination: { order: orderObj },
  })

  res.json({ regions })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorRegionSchema>>,
  res: MedusaResponse
) => {
  const { name, currency_code, countries, payment_providers } = req.validatedBody

  const { result } = await createRegionsWorkflow(req.scope).run({
    input: {
      regions: [
        {
          name,
          currency_code: currency_code.toLowerCase(),
          countries,
          payment_providers: payment_providers?.length
            ? payment_providers
            : ["pp_system_default"],
        },
      ],
    },
  })

  res.status(201).json({ region: result[0] })
}
