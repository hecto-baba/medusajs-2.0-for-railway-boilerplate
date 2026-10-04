import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import {
  buyerGreeting,
  formatMoney,
  orderLabel,
  orderUrl,
  sendNotice,
} from '../lib/email-notice'

// A card payment is captured within seconds of checkout and the order
// confirmation already says it was paid. Only a capture that happens later (an
// admin capturing a manual or authorised payment) needs its own email.
const SAME_CHECKOUT_MS = 2 * 60 * 1000

/** Emails the buyer when a payment is captured after checkout. */
export default async function paymentCapturedEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [payment],
    } = await query.graph({
      entity: 'payment',
      fields: ['id', 'amount', 'currency_code', 'captured_at'],
      filters: { id: data.id },
    })
    if (!payment) return

    const {
      data: [order],
    } = await query.graph({
      entity: 'order',
      fields: [
        'id',
        'display_id',
        'email',
        'created_at',
        'metadata',
        'customer.first_name',
        'customer.last_name',
        'billing_address.first_name',
        'billing_address.last_name',
        'shipping_address.country_code',
        'billing_address.country_code',
      ],
      filters: { payment_collections: { payments: { id: data.id } } },
    })
    // A payment with no order (a cart still in checkout) has nobody to tell yet.
    if (!order?.email || order.metadata?.split_child) return

    const capturedAt = new Date(payment.captured_at ?? Date.now()).getTime()
    if (capturedAt - new Date(order.created_at).getTime() < SAME_CHECKOUT_MS) return

    await sendNotice(container, {
      template: 'payment-received',
      to: order.email,
      subject: `Payment received for order ${orderLabel(order)}`,
      resourceId: payment.id,
      resourceType: 'payment',
      notice: {
        heading: 'Payment received',
        greeting: buyerGreeting(order),
        paragraphs: [`We have received your payment for order ${orderLabel(order)}. Thank you.`],
        rows: [
          { label: 'Order', value: orderLabel(order) },
          { label: 'Amount', value: formatMoney(payment.amount, payment.currency_code) },
        ],
        button: { label: 'View your order', url: orderUrl(order) },
      },
    })
  } catch (error: any) {
    console.error('Error handling payment.captured email:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: 'payment.captured',
  context: { subscriberId: 'payment-captured-email' },
}
