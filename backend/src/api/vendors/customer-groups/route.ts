import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createCustomerGroupsWorkflow } from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import {
  getVendorCustomerGroupIds,
  getVendorId,
  refetchVendorCustomerGroup,
  VENDOR_CUSTOMER_GROUP_FIELDS,
} from "../customers/helpers"

export const GetVendorCustomerGroupsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  created_at_gte: z.string().optional(),
  order: z.string().optional(),
})

export const PostVendorCreateCustomerGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, created_at_gte, order } = (
    req.validatedQuery ?? {}
  ) as z.infer<typeof GetVendorCustomerGroupsSchema>

  const ownedGroupIds = await getVendorCustomerGroupIds(req)

  if (!ownedGroupIds.length) {
    res.json({
      customer_groups: [],
      count: 0,
      limit: limit ?? 20,
      offset: offset ?? 0,
    })
    return
  }

  const filters: Record<string, any> = {
    id: ownedGroupIds,
  }

  if (created_at_gte) {
    filters.created_at = { $gte: created_at_gte }
  }

  if (q && q.trim()) {
    filters.name = { $ilike: `%${q.trim()}%` }
  }

  const orderConfig = order
    ? { [order.replace(/^-/, "")]: order.startsWith("-") ? "DESC" : "ASC" }
    : { created_at: "DESC" }

  const { data: customerGroups, metadata } = await query.graph({
    entity: "customer_group",
    fields: VENDOR_CUSTOMER_GROUP_FIELDS,
    filters,
    pagination: {
      skip: offset ?? 0,
      take: limit ?? 20,
      order: orderConfig,
    },
  })

  const enrichedGroups = customerGroups.map((g: any) => ({
    ...g,
    customers_count: g.customers?.length ?? 0,
  }))

  res.json({
    customer_groups: enrichedGroups,
    count: metadata?.count ?? customerGroups.length,
    limit: limit ?? 20,
    offset: offset ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorCreateCustomerGroupSchema>
  >,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)
  const groupData = req.validatedBody

  const createGroups = createCustomerGroupsWorkflow(req.scope)
  const { result } = await createGroups.run({
    input: {
      customersData: [
        {
          ...groupData,
          created_by: req.auth_context.actor_id,
        },
      ],
    },
  })

  const newGroup = result[0]

  // Link newly created customer group to vendor
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  await remoteLink.create({
    [MARKETPLACE_MODULE]: {
      vendor_id: vendorId,
    },
    [Modules.CUSTOMER]: {
      customer_group_id: newGroup.id,
    },
  })

  const customerGroup = await refetchVendorCustomerGroup(newGroup.id, req)

  res.status(201).json({ customer_group: customerGroup })
}
