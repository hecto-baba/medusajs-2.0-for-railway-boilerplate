import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import {
  buyerGreeting,
  formatMoney,
  orderLabel,
  orderUrl,
  sendNotice,
} from '../lib/email-notice'

// The event only names the payment, not which refund. Two refunds in quick
// succession would both look at the newest one, so every recent refund is
// sent, each under its own idempotency key (the refund id): none is lost and
// none is emailed twice.
const RECENT_MS = 10 * 60 * 1000

/** Emails the buyer when a refund is issued, whether by an admin or a seller. */
export default async function paymentRefundedEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [payment],
    } = await query.graph({
      entity: 'payment',
      fields: ['id', 'currency_code', 'refunds.id', 'refunds.amount', 'refunds.note', 'refunds.created_at'],
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
    if (!order?.email) return

    const recent = ((payment.refunds ?? []) as any[]).filter(
      (refund) => Date.now() - new Date(refund.created_at).getTime() < RECENT_MS
    )

    for (const refund of recent) {
      await sendNotice(container, {
        template: 'refund-issued',
        to: order.email,
        subject: `Your refund for order ${orderLabel(order)}`,
        resourceId: refund.id,
        resourceType: 'refund',
        notice: {
          heading: 'Your refund is on its way',
          greeting: buyerGreeting(order),
          paragraphs: [`We have refunded ${formatMoney(refund.amount, payment.currency_code)} on order ${orderLabel(order)}.`],
          rows: [
            { label: 'Order', value: orderLabel(order) },
            { label: 'Refunded', value: formatMoney(refund.amount, payment.currency_code) },
            ...(refund.note ? [{ label: 'Note', value: String(refund.note) }] : []),
          ],
          button: { label: 'View your order', url: orderUrl(order) },
          footnote: 'Refunds usually reach your original payment method within 3 to 5 business days.',
        },
      })
    }
  } catch (error: any) {
    console.error('Error handling payment.refunded email:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: 'payment.refunded',
  context: { subscriberId: 'payment-refunded-email' },
}
