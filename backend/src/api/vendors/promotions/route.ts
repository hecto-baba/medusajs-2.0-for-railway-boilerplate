import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorPromotionWorkflow } from "../../../workflows/create-vendor-promotion"
import {
  assertCampaignBelongsToVendor,
  assertNoInlineCampaign,
  assertPromotionRulesAreVendorScoped,
} from "./helpers"

export const GetVendorPromotionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  status: z
    .union([
      z.enum(["draft", "active", "inactive"]),
      z.array(z.enum(["draft", "active", "inactive"])),
    ])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value]
    ),
  type: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value]
    ),
  created_at_gte: z.string().optional(),
  order: z.string().optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreatePromotion>,
  res: MedusaResponse
) => {
  await assertPromotionRulesAreVendorScoped(req, req.validatedBody)
  assertNoInlineCampaign(req.validatedBody)
  await assertCampaignBelongsToVendor(
    req,
    (req.validatedBody as any).campaign_id
  )

  const { result } = await createVendorPromotionWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      promotion: req.validatedBody as any,
    },
  })

  res.status(201).json({ promotion: result.promotion })
}

/**
 * Lists the calling vendor's promotions, paginated.
 *
 * Mirrors vendors/products' GET: scoping runs through the admin's own link
 * rather than a request field, and an empty catalogue short-circuits rather
 * than falling through to an unfiltered query.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, status, type, created_at_gte, order } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorPromotionsSchema
  >

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.promotions.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const promotionIds =
    vendorAdmin?.vendor?.promotions
      ?.map((promotion) => promotion?.id)
      .filter(Boolean) ?? []

  if (!promotionIds.length) {
    res.json({ promotions: [], count: 0, limit, offset })
    return
  }

  const desc = order?.startsWith("-") ?? false
  const orderField = order ? (desc ? order.slice(1) : order) : undefined
  const allowedOrder =
    orderField === "code" ||
    orderField === "status" ||
    orderField === "type" ||
    orderField === "created_at"
      ? orderField
      : undefined

  const { data: promotions, metadata } = await query.graph({
    entity: "promotion",
    fields: [
      "id",
      "code",
      "type",
      "status",
      "is_automatic",
      "created_at",
      "application_method.value",
      "application_method.type",
      "application_method.currency_code",
    ],
    filters: {
      id: promotionIds,
      ...(q ? { code: { $ilike: `%${q}%` } } : {}),
      ...(status?.length ? { status } : {}),
      ...(type?.length ? { type } : {}),
      ...(created_at_gte ? { created_at: { $gte: created_at_gte } } : {}),
    },
    pagination: {
      skip: offset,
      take: limit,
      order: allowedOrder
        ? { [allowedOrder]: desc ? "DESC" : "ASC" }
        : { created_at: "DESC" },
    },
  })

  res.json({
    promotions,
    count: metadata?.count ?? promotions.length,
    limit,
    offset,
  })
}
