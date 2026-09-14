import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * Returns the vendor id behind the calling admin.
 */
export const getVendorId = async (
  req: AuthenticatedMedusaRequest
): Promise<string> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorId = vendorAdmin?.vendor?.id

  if (!vendorId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  return vendorId
}

/**
 * Returns all customer ids that belong to the calling vendor:
 * 1. Direct links via `vendor.customers`
 * 2. Order links via `vendor.orders.customer_id`
 */
export const getVendorCustomerIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "vendor.id",
      "vendor.customers.id",
      "vendor.orders.customer_id",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  const directIds = (
    (vendorAdmin.vendor as any).customers as { id?: string }[] | undefined
  )
    ?.map((c) => c?.id)
    .filter((id): id is string => !!id) ?? []

  const orderCustomerIds = (
    (vendorAdmin.vendor as any).orders as { customer_id?: string }[] | undefined
  )
    ?.map((o) => o?.customer_id)
    .filter((id): id is string => !!id) ?? []

  return Array.from(new Set([...directIds, ...orderCustomerIds]))
}

/**
 * Confirms the calling vendor owns/has access to the customer.
 */
export const assertVendorOwnsCustomer = async (
  req: AuthenticatedMedusaRequest,
  customerId: string,
  notFoundMessage = "Customer not found."
): Promise<void> => {
  const ownedIds = await getVendorCustomerIds(req)

  if (!ownedIds.includes(customerId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}

/** Fields returned for customer list/detail view in vendor panel. */
export const VENDOR_CUSTOMER_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "company_name",
  "has_account",
  "metadata",
  "created_at",
  "updated_at",
  "addresses.*",
  "groups.id",
  "groups.name",
]

/**
 * Refetches a customer with vendor order calculations.
 */
export const refetchVendorCustomer = async (
  id: string,
  req: AuthenticatedMedusaRequest
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const vendorId = await getVendorId(req)

  const {
    data: [customer],
  } = await query.graph({
    entity: "customer",
    fields: VENDOR_CUSTOMER_FIELDS,
    filters: { id: [id] },
  })

  if (!customer) {
    return null
  }

  // Count orders placed by this customer for this vendor
  const { data: vendorOrders } = await query.graph({
    entity: "order",
    fields: ["id", "total", "currency_code", "created_at"],
    filters: {
      customer_id: [id],
      vendor: { id: [vendorId] },
    },
  }).catch(() => ({ data: [] }))

  return {
    ...customer,
    orders_count: vendorOrders.length,
    orders: vendorOrders,
  }
}
export const getVendorCustomerGroupIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.customer_groups.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  const groupIds = (
    (vendorAdmin.vendor as any).customer_groups as { id?: string }[] | undefined
  )
    ?.map((g) => g?.id)
    .filter((id): id is string => !!id) ?? []

  return groupIds
}

/**
 * Confirms the calling vendor owns/has access to the customer group.
 */
export const assertVendorOwnsCustomerGroup = async (
  req: AuthenticatedMedusaRequest,
  groupId: string,
  notFoundMessage = "Customer group not found."
): Promise<void> => {
  const ownedIds = await getVendorCustomerGroupIds(req)

  if (!ownedIds.includes(groupId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}

/** Fields returned for customer group list/detail view in vendor panel. */
export const VENDOR_CUSTOMER_GROUP_FIELDS = [
  "id",
  "name",
  "metadata",
  "created_at",
  "updated_at",
  "customers.id",
  "customers.first_name",
  "customers.last_name",
  "customers.email",
  "customers.phone",
  "customers.company_name",
  "customers.has_account",
  "customers.created_at",
]

/**
 * Refetches a customer group with scoped member calculations.
 */
export const refetchVendorCustomerGroup = async (
  id: string,
  req: AuthenticatedMedusaRequest
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [group],
  } = await query.graph({
    entity: "customer_group",
    fields: VENDOR_CUSTOMER_GROUP_FIELDS,
    filters: { id: [id] },
  })

  if (!group) {
    return null
  }

  return {
    ...group,
    customers_count: group.customers?.length ?? 0,
  }
}
