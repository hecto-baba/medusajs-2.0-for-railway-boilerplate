import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import {
  getVendorCustomerIds,
  getVendorId,
  refetchVendorCustomer,
  VENDOR_CUSTOMER_FIELDS,
} from "./helpers"

export const GetVendorCustomersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  has_account: z
    .union([z.boolean(), z.string(), z.array(z.string())])
    .optional(),
  groups: z
    .union([z.string(), z.array(z.string())])
    .optional(),
  created_at_gte: z.string().optional(),
  updated_at_gte: z.string().optional(),
  order: z.string().optional(),
})

export const PostVendorCreateCustomerSchema = z.object({
  email: z.string().email("Invalid email address"),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const vendorId = await getVendorId(req)
  const { limit, offset, q, has_account, groups, created_at_gte, updated_at_gte, order } = (
    req.validatedQuery ?? {}
  ) as z.infer<typeof GetVendorCustomersSchema>

  const ownedCustomerIds = await getVendorCustomerIds(req)

  if (!ownedCustomerIds.length) {
    res.json({
      customers: [],
      count: 0,
      limit: limit ?? 20,
      offset: offset ?? 0,
    })
    return
  }

  const filters: Record<string, any> = {
    id: ownedCustomerIds,
  }

  if (has_account !== undefined) {
    const raw = Array.isArray(has_account) ? has_account[0] : has_account
    if (raw === true || raw === "true") {
      filters.has_account = true
    } else if (raw === false || raw === "false") {
      filters.has_account = false
    }
  }

  if (groups) {
    const groupIds = Array.isArray(groups) ? groups : [groups]
    if (groupIds.length) {
      filters.groups = { id: groupIds }
    }
  }

  if (created_at_gte) {
    filters.created_at = { $gte: created_at_gte }
  }

  if (updated_at_gte) {
    filters.updated_at = { $gte: updated_at_gte }
  }

  if (q && q.trim()) {
    const searchTerm = q.trim()
    filters.$or = [
      { first_name: { $ilike: `%${searchTerm}%` } },
      { last_name: { $ilike: `%${searchTerm}%` } },
      { email: { $ilike: `%${searchTerm}%` } },
      { phone: { $ilike: `%${searchTerm}%` } },
      { company_name: { $ilike: `%${searchTerm}%` } },
    ]
  }

  const orderConfig = order
    ? { [order.replace(/^-/, "")]: order.startsWith("-") ? "DESC" : "ASC" }
    : { created_at: "DESC" }

  const { data: customers, metadata } = await query.graph({
    entity: "customer",
    fields: VENDOR_CUSTOMER_FIELDS,
    filters,
    pagination: {
      skip: offset ?? 0,
      take: limit ?? 20,
      order: orderConfig,
    },
  })

  // Fetch vendor order counts for each customer in the returned page
  const customerIds = customers.map((c: any) => c.id)
  let ordersCountMap: Record<string, number> = {}

  if (customerIds.length) {
    try {
      const { data: vendorOrders } = await query.graph({
        entity: "order",
        fields: ["id", "customer_id"],
        filters: {
          customer_id: customerIds,
          vendor: { id: [vendorId] },
        },
      })

      for (const order of vendorOrders) {
        if (order.customer_id) {
          ordersCountMap[order.customer_id] =
            (ordersCountMap[order.customer_id] || 0) + 1
        }
      }
    } catch {
      // Order query fallback
    }
  }

  const enrichedCustomers = customers.map((c: any) => ({
    ...c,
    orders_count: ordersCountMap[c.id] ?? 0,
  }))

  res.json({
    customers: enrichedCustomers,
    count: metadata?.count ?? customers.length,
    limit: limit ?? 20,
    offset: offset ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorCreateCustomerSchema>
  >,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)
  const customerData = req.validatedBody

  // Run Medusa core workflow to create the customer
  const createCustomers = createCustomersWorkflow(req.scope)
  const { result } = await createCustomers.run({
    input: {
      customersData: [
        {
          ...customerData,
          created_by: req.auth_context.actor_id,
        },
      ],
    },
  })

  const newCustomer = result[0]

  // Link newly created customer to the vendor
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  await remoteLink.create({
    [MARKETPLACE_MODULE]: {
      vendor_id: vendorId,
    },
    [Modules.CUSTOMER]: {
      customer_id: newCustomer.id,
    },
  })

  const customer = await refetchVendorCustomer(newCustomer.id, req)

  res.status(201).json({ customer })
}
