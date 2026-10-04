import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { MedusaContainer } from '@medusajs/framework/types'
import { MARKETPLACE_MODULE } from '../modules/marketplace'
import { formatMoney, orderLabel, sendNotice } from './email-notice'
import { loadVendorsForProducts } from './vendor-recipients'
import { toNumber } from './money'

type Target = { orderId: string; vendorId: string }

const ORDER_FIELDS = [
  'id',
  'display_id',
  'currency_code',
  'total',
  'items.title',
  'items.quantity',
  'items.total',
  'items.product_id',
  'shipping_address.first_name',
  'shipping_address.last_name',
  'shipping_address.city',
  'shipping_address.country_code',
]

/**
 * Tells each vendor about the order that is theirs.
 *
 * DATA ISOLATION: a vendor's email is built only from THEIR order's own lines.
 *  - several vendors  -> each vendor is told about their CHILD order. The buyer's
 *    parent order, which holds every vendor's items, is never read for these.
 *  - one vendor       -> the parent order is that vendor's order.
 * As a second guard, any line whose product belongs to a different vendor is
 * dropped, so a mistake upstream still cannot leak another vendor's items or totals.
 *
 * Cost does not grow with the number of vendors: one read for the orders, one for
 * who owns the products, one for the vendors' emails.
 *
 * \`mode\` comes from splitOrderBySeller. Idempotent per order and recipient, so a
 * retried split does not email twice. Never throws.
 */
export const sendVendorOrderEmails = async (
  container: MedusaContainer,
  parentOrderId: string,
  mode: 'none' | 'single' | 'split' | 'child'
): Promise<number> => {
  if (mode === 'none' || mode === 'child') return 0

  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const targets: Target[] = []

    // Orders to read, in one query. For a single seller the parent IS their order.
    let orders: any[]
    if (mode === 'split') {
      const marketplace: any = container.resolve(MARKETPLACE_MODULE)
      const splits: any[] = await marketplace.listVendorOrderSplits({ parent_order_id: parentOrderId })
      for (const split of splits) targets.push({ orderId: split.child_order_id, vendorId: split.vendor_id })
      if (!targets.length) return 0
      const { data } = await query.graph({
        entity: 'order',
        fields: ORDER_FIELDS,
        filters: { id: targets.map((t) => t.orderId) },
      })
      orders = data ?? []
    } else {
      const { data } = await query.graph({ entity: 'order', fields: ORDER_FIELDS, filters: { id: parentOrderId } })
      orders = data ?? []
    }
    const orderById = new Map(orders.map((order) => [order.id, order]))

    // Who owns every product involved, once.
    const productIds = orders.flatMap((order) => ((order.items ?? []) as any[]).map((i) => i.product_id)).filter(Boolean)
    const { sellerOf, recipients } = await loadVendorsForProducts(
      container,
      productIds,
      targets.map((t) => t.vendorId)
    )

    if (mode === 'single') {
      const vendorId = [...sellerOf.values()][0]
      if (!vendorId) return 0
      targets.push({ orderId: parentOrderId, vendorId })
    }

    let sent = 0
    for (const target of targets) {
      try {
        const vendor = recipients.get(target.vendorId)
        const order = orderById.get(target.orderId)
        if (!vendor?.emails.length || !order) continue

        const ownItems = ((order.items ?? []) as any[]).filter((item) => {
          const owner = sellerOf.get(item.product_id)
          return !owner || owner === target.vendorId
        })
        if (!ownItems.length) continue

        const ownTotal = ownItems.reduce((sum, item) => sum + toNumber(item.total), 0)
        const ship = order.shipping_address
        const shipTo = [
          [ship?.first_name, ship?.last_name].filter(Boolean).join(' '),
          ship?.city,
          ship?.country_code?.toUpperCase(),
        ]
          .filter(Boolean)
          .join(', ')

        for (const to of vendor.emails) {
          const result = await sendNotice(container, {
            template: 'vendor-new-order',
            to,
            subject: `New order ${orderLabel(order)}`,
            resourceId: order.id,
            resourceType: 'order',
            keySuffix: to,
            notice: {
              heading: 'You have a new order',
              greeting: `Hello ${vendor.name},`,
              paragraphs: ['A customer has placed an order for your products. Open it in your dashboard to prepare and ship it.'],
              rows: [
                { label: 'Order', value: orderLabel(order) },
                { label: 'Your items total', value: formatMoney(ownTotal, order.currency_code) },
                ...(shipTo ? [{ label: 'Ship to', value: shipTo }] : []),
              ],
              items: ownItems.map((item) => ({
                name: String(item.title ?? 'Item'),
                quantity: String(toNumber(item.quantity)),
                total: formatMoney(item.total, order.currency_code),
              })),
            },
          })
          if (result === 'sent') sent++
        }
      } catch (error: any) {
        console.error(`Could not email vendor ${target.vendorId} about order ${target.orderId}:`, error?.message ?? error)
      }
    }
    return sent
  } catch (error: any) {
    console.error(`Could not email vendors about order ${parentOrderId}:`, error?.message ?? error)
    return 0
  }
}
