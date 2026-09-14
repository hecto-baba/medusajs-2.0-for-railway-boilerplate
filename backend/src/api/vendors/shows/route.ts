import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { RowType } from "../../../modules/ticket-booking/models/venue-row"
import { createVendorTicketProductWorkflow } from "../../../workflows/create-vendor-ticket-product"
import { assertVendorOwnsVenue, getVendorId } from "../venues/helpers"
import {
  getVendorShowIds,
  transformVendorShow,
  VENDOR_SHOW_FIELDS,
} from "./helpers"

export const PostVendorShowBodySchema = z.object({
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

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const showIds = await getVendorShowIds(req)

  const limit = req.queryConfig?.pagination?.take ?? 20
  const offset = req.queryConfig?.pagination?.skip ?? 0

  if (!showIds.length) {
    return res.json({
      shows: [],
      count: 0,
      limit,
      offset,
    })
  }

  const filters: Record<string, any> = {
    id: showIds,
  }

  const q = req.query?.q as string | undefined
  if (q?.trim()) {
    filters.$or = [
      { product: { title: { $ilike: `%${q.trim()}%` } } },
      { venue: { name: { $ilike: `%${q.trim()}%` } } },
    ]
  }

  const { data: ticketProducts, metadata } = await query.graph({
    entity: "ticket_product",
    fields: req.queryConfig?.fields?.length ? req.queryConfig.fields : VENDOR_SHOW_FIELDS,
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: req.queryConfig?.pagination?.order,
    },
  })

  const transformedShows = ticketProducts.map(transformVendorShow)

  res.json({
    shows: transformedShows,
    count: metadata?.count ?? transformedShows.length,
    limit: metadata?.take ?? limit,
    offset: metadata?.skip ?? offset,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostVendorShowBodySchema>>,
  res: MedusaResponse
) => {
  // Validate vendor ownership of the venue
  await assertVendorOwnsVenue(req, req.validatedBody.venue_id)
  const vendorId = await getVendorId(req)

  const { result } = await createVendorTicketProductWorkflow(req.scope).run({
    input: {
      vendor_id: vendorId,
      vendor_admin_id: req.auth_context.actor_id,
      name: req.validatedBody.name.trim(),
      description: req.validatedBody.description?.trim(),
      venue_id: req.validatedBody.venue_id,
      dates: req.validatedBody.dates,
      variants: req.validatedBody.variants.map((v) => ({
        row_type: v.row_type,
        seat_count: v.seat_count,
        prices: v.prices.map((p) => ({
          currency_code: p.currency_code.toLowerCase(),
          amount: p.amount,
          min_quantity: p.min_quantity,
          max_quantity: p.max_quantity,
        })),
      })),
    },
  })

  res.status(201).json({
    show: transformVendorShow(result.ticket_product),
  })
}
