import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { MedusaContainer } from '@medusajs/framework/types'
import { loadProductSellers } from './cart-shipping'
import { ADMIN_NOTIFICATION_EMAIL } from './email-notice'

export type VendorRecipient = { id: string; name: string; emails: string[] }

/**
 * Who to email for a vendor: the login email of each of its dashboard admins
 * (decision: vendor emails go to the address they log in with).
 */
export const loadVendorRecipients = async (
  container: Pick<MedusaContainer, 'resolve'>,
  vendorIds: string[]
): Promise<Map<string, VendorRecipient>> => {
  const result = new Map<string, VendorRecipient>()
  const ids = [...new Set(vendorIds.filter(Boolean))]
  if (!ids.length) return result

  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: vendors } = await query.graph({
    entity: 'vendor',
    fields: ['id', 'name', 'admins.email'],
    filters: { id: ids },
  })

  for (const vendor of (vendors ?? []) as any[]) {
    result.set(vendor.id, {
      id: vendor.id,
      name: vendor.name ?? 'your store',
      emails: [...new Set(((vendor.admins ?? []) as any[]).map((a) => a?.email).filter(Boolean))] as string[],
    })
  }
  return result
}

/**
 * Who owns each product, and the emails of those owners, in TWO queries however
 * many products are asked about (loadProductSellers reads every vendor, so it must
 * be called once per batch, never once per item).
 *
 * `extraVendorIds` adds vendors named outside the products (a quote can name its
 * vendor in metadata). Products with no vendor are the platform's own.
 */
export const loadVendorsForProducts = async (
  container: MedusaContainer,
  productIds: string[],
  extraVendorIds: string[] = []
): Promise<{ sellerOf: Map<string, string>; recipients: Map<string, VendorRecipient> }> => {
  const sellers = await loadProductSellers(container, [...new Set(productIds.filter(Boolean))])
  const sellerOf = new Map([...sellers.entries()].map(([productId, seller]) => [productId, seller.id]))
  const recipients = await loadVendorRecipients(container, [...sellerOf.values(), ...extraVendorIds])
  return { sellerOf, recipients }
}

/** The platform operator's address as a list, for when a request has no vendor to go to. */
export const platformFallback = (): string[] => (ADMIN_NOTIFICATION_EMAIL ? [ADMIN_NOTIFICATION_EMAIL] : [])

/**
 * The vendors that own a set of products, with their emails. Single-use form of
 * loadVendorsForProducts for callers that handle one request at a time.
 */
export const loadProductVendorRecipients = async (
  container: MedusaContainer,
  productIds: string[],
  explicitVendorId?: string | null
): Promise<{ vendors: VendorRecipient[]; fallback: string[] }> => {
  const { sellerOf, recipients } = await loadVendorsForProducts(container, productIds, explicitVendorId ? [explicitVendorId] : [])
  const ids = new Set([...sellerOf.values(), ...(explicitVendorId ? [explicitVendorId] : [])])
  const vendors = [...ids].map((id) => recipients.get(id)).filter((v): v is VendorRecipient => !!v && v.emails.length > 0)
  return { vendors, fallback: platformFallback() }
}
