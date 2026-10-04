import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { formatMoney, sendNotice } from '../lib/email-notice'
import { toNumber } from '../lib/money'

/**
 * Emails a restaurant's admins when a new delivery needs preparing.
 *
 * The delivery workflow already announces this with a `notify.restaurant`
 * event (notify-restaurant.ts) but nothing listened to it, so restaurants had no
 * way to find out except watching their dashboard. The email goes to the login
 * email of each restaurant admin. The delivery id is the idempotency key, so a
 * redelivered event does not email twice.
 */
export default async function restaurantNewDeliveryEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ restaurant_id?: string; delivery_id: string }>) {
  try {
    if (!data.restaurant_id) return

    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [restaurant],
    } = await query.graph({
      entity: 'restaurant',
      fields: ['id', 'name', 'admins.email'],
      filters: { id: data.restaurant_id },
    })
    const emails = [...new Set(((restaurant?.admins ?? []) as any[]).map((a) => a?.email).filter(Boolean))] as string[]
    if (!emails.length) return

    // Only the items from THIS restaurant's delivery (the cart behind it).
    const {
      data: [delivery],
    } = await query.graph({
      entity: 'deliveries',
      fields: [
        'id',
        'cart.currency_code',
        'cart.items.title',
        'cart.items.quantity',
        'cart.items.total',
        'cart.shipping_address.city',
      ],
      filters: { id: data.delivery_id },
    })
    const cart = delivery?.cart
    const items = ((cart?.items ?? []) as any[]).map((item) => ({
      name: String(item.title ?? 'Item'),
      quantity: String(toNumber(item.quantity)),
      total: formatMoney(item.total, cart?.currency_code),
    }))

    for (const to of emails) {
      await sendNotice(container, {
        template: 'restaurant-new-delivery',
        to,
        subject: 'New order to prepare',
        resourceId: data.delivery_id,
        resourceType: 'delivery',
        keySuffix: to,
        notice: {
          heading: 'A new order is waiting',
          greeting: `Hello ${restaurant.name ?? ''},`.replace(' ,', ','),
          paragraphs: [
            'A customer has paid for an order from your restaurant. Open your dashboard to see it and start preparing when a driver is on the way.',
          ],
          rows: cart?.shipping_address?.city ? [{ label: 'Delivering to', value: cart.shipping_address.city }] : [],
          items,
        },
      })
    }
  } catch (error: any) {
    console.error('Error handling notify.restaurant email:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: 'notify.restaurant',
  context: { subscriberId: 'restaurant-new-delivery-email' },
}
