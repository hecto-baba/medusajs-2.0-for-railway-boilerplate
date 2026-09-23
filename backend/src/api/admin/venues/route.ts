import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RowType } from "../../../modules/ticket-booking/models/venue-row"
import { createVenueWorkflow } from "../../../workflows/create-venue"

export const PostVenueBodySchema = z.object({
  name: z.string().min(1, "A venue name is required"),
  address: z.string().optional(),
  rows: z
    .array(
      z.object({
        row_number: z.string().min(1, "A row number is required"),
        row_type: z.nativeEnum(RowType),
        seat_count: z
          .number()
          .int()
          .min(1, "A row must have at least one seat"),
      })
    )
    .min(1, "A venue needs at least one row")
    .refine(
      (rows) =>
        new Set(rows.map((row) => row.row_number)).size === rows.length,
      { message: "Row numbers must be unique within a venue" }
    ),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostVenueBodySchema>>,
  res: MedusaResponse
) => {
  const { result } = await createVenueWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(201).json(result)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve("query")

  const filters: Record<string, any> = { ...req.filterableFields }
  const q = req.query?.q as string | undefined
  if (q?.trim()) {
    delete filters.q
    filters.$or = [
      { name: { $ilike: `%${q.trim()}%` } },
      { address: { $ilike: `%${q.trim()}%` } },
    ]
  }

  const { data: venues, metadata } = await query.graph({
    entity: "venue",
    fields: req.queryConfig.fields,
    filters,
    pagination: req.queryConfig.pagination,
  })

  res.json({
    venues,
    count: metadata?.count ?? venues.length,
    limit: metadata?.take ?? venues.length,
    offset: metadata?.skip ?? 0,
  })
}
