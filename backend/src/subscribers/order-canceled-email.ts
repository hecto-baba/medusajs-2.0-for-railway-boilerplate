import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import {
  buyerGreeting,
  loadOrderForEmail,
  orderLabel,
  orderUrl,
  sendNotice,
} from '../lib/email-notice'

/**
 * Emails the buyer when their order is cancelled, whoever cancelled it and
 * including automatic cancels (a seat or appointment lost after payment).
 *
 * Only the buyer's own (parent) order: a seller's child order is internal, and
 * cancelling the parent already cancels every child, so emailing for the
 * children would send the buyer duplicates for an order they never saw.
 *
 * Kept apart from order-canceled.ts so a failure there (payouts, rentals,
 * appointments) can never stop this email, and the reverse.
 */
export default async function orderCanceledEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const order = await loadOrderForEmail(container, data.id)
    if (!order?.email || order.metadata?.split_child) return

    const reason = typeof order.metadata?.cancel_reason === 'string' ? order.metadata.cancel_reason : null

    await sendNotice(container, {
      template: 'order-cancelled',
      to: order.email,
      subject: `Your order ${orderLabel(order)} was cancelled`,
      resourceId: order.id,
      resourceType: 'order',
      notice: {
        heading: 'Your order was cancelled',
        greeting: buyerGreeting(order),
        paragraphs: [
          `Your order ${orderLabel(order)} has been cancelled.`,
          'If you paid, any refund is processed separately and you will get another email when it is issued.',
        ],
        rows: [
          { label: 'Order', value: orderLabel(order) },
          ...(reason ? [{ label: 'Reason', value: reason }] : []),
        ],
        button: { label: 'View your order', url: orderUrl(order) },
      },
    })
  } catch (error: any) {
    console.error('Error handling order.canceled email:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: 'order.canceled',
  context: { subscriberId: 'order-canceled-email' },
}
