import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import type { BookingFailedEvent } from '../lib/booking-failed'
import {
  ADMIN_NOTIFICATION_EMAIL,
  buyerGreeting,
  loadOrderForEmail,
  orderLabel,
  sendNotice,
} from '../lib/email-notice'

/**
 * A buyer paid but the appointment time or ticket seat was lost. Tells the buyer
 * what happened and that a refund follows, and tells the platform operator,
 * because someone has to issue that refund by hand.
 */
export default async function bookingFailedEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<BookingFailedEvent>) {
  try {
    const order = await loadOrderForEmail(container, data.order_id)
    if (!order) return

    const what = data.kind === 'ticket' ? 'tickets' : 'appointment'
    const detail = data.detail ?? `Your ${what} could not be secured.`

    if (order.email) {
      await sendNotice(container, {
        template: 'booking-failed',
        to: order.email,
        subject: `We could not secure your ${what}`,
        resourceId: order.id,
        resourceType: 'order',
        keySuffix: data.kind,
        notice: {
          heading: `We could not secure your ${what}`,
          greeting: buyerGreeting(order),
          paragraphs: [
            `We are sorry: your payment for order ${orderLabel(order)} went through, but ${detail.charAt(0).toLowerCase()}${detail.slice(1)}`,
            'You will be refunded in full. We will email you again as soon as the refund is issued, and you are welcome to reply to this email if you have any questions.',
          ],
          rows: [{ label: 'Order', value: orderLabel(order) }],
        },
      })
    }

    if (ADMIN_NOTIFICATION_EMAIL) {
      await sendNotice(container, {
        template: 'booking-failed-admin',
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `Action needed: refund order ${orderLabel(order)}`,
        resourceId: order.id,
        resourceType: 'order',
        keySuffix: data.kind,
        notice: {
          heading: 'A paid booking failed',
          paragraphs: [
            `Order ${orderLabel(order)} was paid, but the ${what} could not be secured. The buyer has been told a refund will follow. Please refund the order.`,
            detail,
          ],
          rows: [
            { label: 'Order', value: orderLabel(order) },
            { label: 'Buyer', value: order.email ?? 'unknown' },
            { label: 'Kind', value: data.kind },
          ],
        },
      })
    } else {
      console.warn(
        `booking.failed for order ${order.id}: ADMIN_NOTIFICATION_EMAIL is not set, so nobody was alerted to issue the refund`
      )
    }
  } catch (error: any) {
    console.error('Error handling booking.failed email:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: 'booking.failed',
  context: { subscriberId: 'booking-failed-email' },
}
