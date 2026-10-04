import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getVendorId, resolveVendorAdmin } from "../shared/vendor-scope"

// Single source of truth lives in shared/vendor-scope.ts; re-exported so
// existing imports from this file keep working.
export { getVendorId }


/**
 * Returns all customer ids that belong to the calling vendor:
 * 1. Direct links via `vendor.customers`
 * 2. Order links via `vendor.orders.customer_id`
 */
export const getVendorCustomerIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const vendorAdmin = await resolveVendorAdmin(req, [
    "vendor.id",
    "vendor.customers.id",
    "vendor.orders.customer_id",
    "vendor.orders.metadata",
  ])

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
    (vendorAdmin.vendor as any).orders as
      | { customer_id?: string; metadata?: { buyer_customer_id?: string | null } }[]
      | undefined
  )
    // A seller's child order keeps the buyer in metadata, not customer_id.
    ?.map((o) => o?.customer_id ?? o?.metadata?.buyer_customer_id)
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

/** Ids of the customers the seller created (linked directly), not those who only ordered. */
export const getVendorDirectCustomerIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const vendorAdmin = await resolveVendorAdmin(req, [
    "vendor.id",
    "vendor.customers.id",
  ])

  return (
    ((vendorAdmin?.vendor as any)?.customers as { id?: string }[] | undefined) ?? []
  )
    .map((customer) => customer?.id)
    .filter((id): id is string => !!id)
}

/**
 * A seller READS the customers they created and those who ordered from them,
 * but WRITES only to customers they created. Answers 404 for a customer they
 * cannot see at all, and a clear "not allowed" for one they can see but did not
 * create (so the message is not misleading, and reveals nothing new).
 */
export const assertVendorManagesCustomer = async (
  req: AuthenticatedMedusaRequest,
  customerId: string
): Promise<void> => {
  await assertVendorOwnsCustomer(req, customerId)

  const directIds = await getVendorDirectCustomerIds(req)

  if (!directIds.includes(customerId)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "You can only change customers you created."
    )
  }
}

type CustomerView = {
  id: string
  groups?: { id: string }[] | null
  addresses?: unknown[] | null
  metadata?: unknown
  [key: string]: unknown
}

/**
 * Shapes a customer for the calling seller:
 *   - only the seller's OWN groups are listed (group names are another
 *     seller's business);
 *   - a customer who only ordered is shown without addresses or metadata.
 */
export const shapeCustomerForVendor = <T extends CustomerView>(
  customer: T,
  directIds: Set<string>,
  ownedGroupIds: Set<string>
): T => {
  const shaped: CustomerView = {
    ...customer,
    groups: (customer.groups ?? []).filter((group) => ownedGroupIds.has(group.id)),
  }

  if (!directIds.has(customer.id)) {
    shaped.addresses = []
    shaped.metadata = null
  }

  return shaped as T
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
    fields: ["id", "total", "currency_code", "created_at", "customer_id", "metadata"],
    filters: {
      vendor: { id: [vendorId] },
    },
  }).catch(() => ({ data: [] }))

  // The vendor's orders placed by THIS customer (a seller's child order keeps the
  // buyer in metadata rather than customer_id).
  const customerOrders = (vendorOrders as any[])
    .filter((order) => order.customer_id === id || order.metadata?.buyer_customer_id === id)
    .map(({ customer_id, metadata, ...rest }) => rest)

  const directIds = new Set(await getVendorDirectCustomerIds(req))
  const ownedGroupIds = new Set(await getVendorCustomerGroupIds(req))

  return {
    ...shapeCustomerForVendor(customer as any, directIds, ownedGroupIds),
    orders_count: customerOrders.length,
    orders: customerOrders,
  }
}
export const getVendorCustomerGroupIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const vendorAdmin = await resolveVendorAdmin(req, [
    "vendor.id",
    "vendor.customer_groups.id",
  ])

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
