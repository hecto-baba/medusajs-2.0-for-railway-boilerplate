import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RowType } from "../../../modules/ticket-booking/models/venue-row"
import { createTicketProductWorkflow } from "../../../workflows/create-ticket-product"

export const PostTicketProductBodySchema = z.object({
  name: z.string().min(1, "A show name is required"),
  description: z.string().optional(),
  venue_id: z.string().min(1, "A venue is required"),
  dates: z
    .array(
      z.string().refine((value) => !isNaN(Date.parse(value)), {
        message: "Each date must be a valid date string",
      })
    )
    .min(1, "A show needs at least one date")
    .refine((dates) => new Set(dates).size === dates.length, {
      message: "Show dates must be unique",
    }),
  variants: z
    .array(
      z.object({
        row_type: z.nativeEnum(RowType),
        // How many seats of this tier go on sale per performance. Required
        // rather than derived from the venue's rows so a run can be sold at
        // less than the venue's full capacity.
        seat_count: z.number().int().min(1, "Seat count must be at least 1"),
        prices: z
          .array(
            z.object({
              currency_code: z.string().min(1),
              amount: z.number().min(0),
              min_quantity: z.number().optional(),
              max_quantity: z.number().optional(),
            })
          )
          .min(1, "Each seating tier needs at least one price"),
      })
    )
    .min(1, "A show needs at least one seating tier")
    .refine(
      (variants) =>
        new Set(variants.map((variant) => variant.row_type)).size ===
        variants.length,
      { message: "Each seating tier may only be priced once" }
    ),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostTicketProductBodySchema>>,
  res: MedusaResponse
) => {
  const { result } = await createTicketProductWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(201).json(result)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve("query")

  const filters: Record<string, any> = { ...(req.filterableFields ?? {}) }
  const q = req.query?.q as string | undefined
  if (q?.trim()) {
    delete filters.q
    filters.$or = [
      { product: { title: { $ilike: `%${q.trim()}%` } } },
      { venue: { name: { $ilike: `%${q.trim()}%` } } },
    ]
  }

  const { data: ticket_products, metadata } = await query.graph({
    entity: "ticket_product",
    fields: req.queryConfig.fields,
    filters,
    pagination: req.queryConfig.pagination,
  })

  res.json({
    ticket_products,
    count: metadata?.count ?? ticket_products.length,
    limit: metadata?.take ?? ticket_products.length,
    offset: metadata?.skip ?? 0,
  })
}
