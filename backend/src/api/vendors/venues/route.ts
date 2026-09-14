import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { RowType } from "../../../modules/ticket-booking/models/venue-row"
import { createVendorVenueWorkflow } from "../../../workflows/create-vendor-venue"
import {
  getVendorId,
  getVendorVenueIds,
  transformVendorVenue,
  VENDOR_VENUE_FIELDS,
} from "./helpers"

export const PostVendorVenueBodySchema = z.object({
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
        new Set(rows.map((row) => row.row_number.trim().toUpperCase())).size ===
        rows.length,
      { message: "Row numbers must be unique within a venue" }
    ),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const venueIds = await getVendorVenueIds(req)

  const limit = req.queryConfig?.pagination?.take ?? 20
  const offset = req.queryConfig?.pagination?.skip ?? 0

  if (!venueIds.length) {
    return res.json({
      venues: [],
      count: 0,
      limit,
      offset,
    })
  }

  const filters: Record<string, any> = {
    id: venueIds,
  }

  const q = req.query?.q as string | undefined
  if (q?.trim()) {
    filters.$or = [
      { name: { $ilike: `%${q.trim()}%` } },
      { address: { $ilike: `%${q.trim()}%` } },
    ]
  }

  const { data: venues, metadata } = await query.graph({
    entity: "venue",
    fields: req.queryConfig?.fields?.length ? req.queryConfig.fields : VENDOR_VENUE_FIELDS,
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: req.queryConfig?.pagination?.order,
    },
  })

  const transformedVenues = venues.map(transformVendorVenue)

  res.json({
    venues: transformedVenues,
    count: metadata?.count ?? transformedVenues.length,
    limit: metadata?.take ?? limit,
    offset: metadata?.skip ?? offset,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostVendorVenueBodySchema>>,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)

  const { result } = await createVendorVenueWorkflow(req.scope).run({
    input: {
      vendor_id: vendorId,
      vendor_admin_id: req.auth_context.actor_id,
      name: req.validatedBody.name.trim(),
      address: req.validatedBody.address?.trim(),
      rows: req.validatedBody.rows.map((row) => ({
        row_number: row.row_number.trim().toUpperCase(),
        row_type: row.row_type,
        seat_count: Number(row.seat_count),
      })),
    },
  })

  res.status(201).json({
    venue: transformVendorVenue(result.venue),
  })
}
