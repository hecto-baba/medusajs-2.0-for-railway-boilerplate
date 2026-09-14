import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createPriceListsWorkflow } from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import {
  assertVendorOwnsVariants,
  getVendorId,
  getVendorPriceListIds,
  refetchVendorPriceList,
  transformVendorPriceList,
  VENDOR_PRICE_LIST_FIELDS,
} from "./helpers"

export const GetVendorPriceListsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  type: z.union([z.string(), z.array(z.string())]).optional(),
  order: z.string().optional(),
})

export const PostVendorCreatePriceListPriceSchema = z.object({
  variant_id: z.string().min(1, "Variant ID is required"),
  currency_code: z.string().min(1, "Currency code is required"),
  amount: z.number().min(0, "Amount must be greater than or equal to 0"),
  min_quantity: z.number().int().min(1).nullish(),
  max_quantity: z.number().int().min(1).nullish(),
  rules: z.record(z.string(), z.string()).optional(),
})

export const PostVendorCreatePriceListSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  type: z.enum(["sale", "override"]).default("sale"),
  status: z.enum(["active", "draft"]).default("active"),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
  rules: z.record(z.string(), z.array(z.string())).optional(),
  prices: z.array(PostVendorCreatePriceListPriceSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, status, type, order } = (
    req.validatedQuery ?? {}
  ) as z.infer<typeof GetVendorPriceListsSchema>

  const ownedPriceListIds = await getVendorPriceListIds(req)

  if (!ownedPriceListIds.length) {
    res.json({
      price_lists: [],
      count: 0,
      limit: limit ?? 20,
      offset: offset ?? 0,
    })
    return
  }

  const filters: Record<string, any> = {
    id: ownedPriceListIds,
  }

  if (status) {
    filters.status = Array.isArray(status) ? status : [status]
  }

  if (type) {
    filters.type = Array.isArray(type) ? type : [type]
  }

  if (q && q.trim()) {
    const searchTerm = q.trim()
    filters.$or = [
      { title: { $ilike: `%${searchTerm}%` } },
      { description: { $ilike: `%${searchTerm}%` } },
    ]
  }

  const orderConfig = order
    ? { [order.replace(/^-/, "")]: order.startsWith("-") ? "DESC" : "ASC" }
    : { created_at: "DESC" }

  const { data: priceLists, metadata } = await query.graph({
    entity: "price_list",
    fields: VENDOR_PRICE_LIST_FIELDS,
    filters,
    pagination: {
      skip: offset ?? 0,
      take: limit ?? 20,
      order: orderConfig,
    },
  })

  const transformedPriceLists = priceLists.map(transformVendorPriceList)

  res.json({
    price_lists: transformedPriceLists,
    count: metadata?.count ?? priceLists.length,
    limit: limit ?? 20,
    offset: offset ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorCreatePriceListSchema>
  >,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)
  const payload = req.validatedBody

  // Validate variant ownership for any provided prices
  if (payload.prices && payload.prices.length) {
    const variantIds = payload.prices.map((p) => p.variant_id)
    await assertVendorOwnsVariants(req, variantIds)
  }

  // Format payload for createPriceListsWorkflow
  const workflowInput = {
    price_lists_data: [
      {
        ...payload,
        starts_at: payload.starts_at || null,
        ends_at: payload.ends_at || null,
        description: payload.description || undefined,
        rules: payload.rules || undefined,
        prices: payload.prices || undefined,
        metadata: payload.metadata || undefined,
      },
    ],
  }

  const workflow = createPriceListsWorkflow(req.scope)
  const { result } = await workflow.run({
    input: workflowInput,
  })

  const newPriceList = result[0]

  // Link newly created price list to vendor
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  await remoteLink.create({
    [MARKETPLACE_MODULE]: {
      vendor_id: vendorId,
    },
    [Modules.PRICING]: {
      price_list_id: newPriceList.id,
    },
  })

  const priceList = await refetchVendorPriceList(newPriceList.id, req)

  res.status(201).json({ price_list: priceList })
}
