import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { TICKET_BOOKING_MODULE } from "../../../../modules/ticket-booking"
import { RowType } from "../../../../modules/ticket-booking/models/venue-row"
import {
  assertVendorOwnsVenue,
  transformVendorVenue,
  VENDOR_VENUE_FIELDS,
} from "../helpers"

export const UpdateVendorVenueBodySchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  rows: z
    .array(
      z.object({
        id: z.string().optional(),
        row_number: z.string().min(1, "A row number is required"),
        row_type: z.nativeEnum(RowType),
        seat_count: z
          .number()
          .int()
          .min(1, "A row must have at least one seat"),
      })
    )
    .optional()
    .refine(
      (rows) =>
        !rows ||
        new Set(rows.map((row) => row.row_number.trim().toUpperCase())).size ===
          rows.length,
      { message: "Row numbers must be unique within a venue" }
    ),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsVenue(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [venue],
  } = await query.graph({
    entity: "venue",
    fields: req.queryConfig?.fields?.length ? req.queryConfig.fields : VENDOR_VENUE_FIELDS,
    filters: { id: [id] },
  })

  if (!venue) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Venue not found.")
  }

  // Also query any shows hosted at this venue
  const { data: shows } = await query.graph({
    entity: "ticket_product",
    fields: ["id", "product_id", "dates", "product.title", "product.thumbnail"],
    filters: { venue_id: [id] },
  })

  res.json({
    venue: {
      ...transformVendorVenue(venue),
      shows: shows || [],
    },
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorVenueBodySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsVenue(req, id)

  const ticketBookingService = req.scope.resolve(TICKET_BOOKING_MODULE) as any

  const updateData: Record<string, any> = {}
  if (req.validatedBody.name !== undefined) {
    updateData.name = req.validatedBody.name.trim()
  }
  if (req.validatedBody.address !== undefined) {
    updateData.address = req.validatedBody.address?.trim() || null
  }

  if (Object.keys(updateData).length > 0) {
    await ticketBookingService.updateVenues({
      id,
      ...updateData,
    })
  }

  // If rows are updated: replace/upsert rows
  if (req.validatedBody.rows !== undefined) {
    const existingRows = await ticketBookingService.listVenueRows({
      venue_id: id,
    })
    const existingRowIds = existingRows.map((r: any) => r.id)

    // Delete existing rows
    if (existingRowIds.length > 0) {
      await ticketBookingService.deleteVenueRows(existingRowIds)
    }

    // Create new rows
    if (req.validatedBody.rows.length > 0) {
      await ticketBookingService.createVenueRows(
        req.validatedBody.rows.map((row) => ({
          venue_id: id,
          row_number: row.row_number.trim().toUpperCase(),
          row_type: row.row_type,
          seat_count: Number(row.seat_count),
        }))
      )
    }
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [updatedVenue],
  } = await query.graph({
    entity: "venue",
    fields: VENDOR_VENUE_FIELDS,
    filters: { id: [id] },
  })

  res.json({
    venue: transformVendorVenue(updatedVenue),
  })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsVenue(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Check if any shows exist using this venue
  const { data: shows } = await query.graph({
    entity: "ticket_product",
    fields: ["id"],
    filters: { venue_id: [id] },
  })

  if (shows && shows.length > 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Cannot delete a venue that is assigned to active shows. Delete the shows first."
    )
  }

  const ticketBookingService = req.scope.resolve(TICKET_BOOKING_MODULE) as any
  await ticketBookingService.deleteVenues([id])

  res.json({
    id,
    object: "venue",
    deleted: true,
  })
}
