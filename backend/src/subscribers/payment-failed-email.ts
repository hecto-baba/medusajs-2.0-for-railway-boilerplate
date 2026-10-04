import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys, Modules, PaymentActions, PaymentWebhookEvents } from '@medusajs/framework/utils'
import { cartUrl, formatMoney, greetingFor, sendNotice } from '../lib/email-notice'

/**
 * Emails the shopper when a payment attempt fails.
 *
 * Medusa's own webhook handler deliberately ignores failed payments (it only
 * advances successful ones), so nothing in core reacts to them. This listens to
 * the same webhook event, asks the payment provider what it means, and acts only
 * on FAILED. Every failure is emailed, as agreed; the Stripe event id is the
 * idempotency key, so Stripe redelivering one webhook never sends it twice while
 * a genuine second failed attempt (a different event) still does.
 */
export default async function paymentFailedEmailHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  try {
    const input = event.data
    if (input?.payload?.rawData?.type === 'Buffer') {
      input.payload.rawData = Buffer.from(input.payload.rawData.data)
    }

    // Asking the provider to interpret an event can itself call Stripe (it looks
    // up the payment method on created/processing events), and this handler
    // sees every webhook. The raw body names the event type, so look at that first
    // and leave everything that is not a failure alone.
    const type = input?.payload?.data?.type
    if (typeof type === 'string' && !/fail/i.test(type)) return

    const payments: any = container.resolve(Modules.PAYMENT)
    const processed = await payments.getWebhookActionAndData(input)
    if (processed?.action !== PaymentActions.FAILED || !processed.data?.session_id) return

    const sessionId: string = processed.data.session_id
    const session = await payments.retrievePaymentSession(sessionId, {
      select: ['id', 'payment_collection_id', 'currency_code', 'amount'],
    })

    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [cart],
    } = await query.graph({
      entity: 'cart',
      fields: [
        'id',
        'email',
        'currency_code',
        'total',
        'completed_at',
        'customer.first_name',
        'customer.last_name',
        'shipping_address.first_name',
        'shipping_address.last_name',
        'shipping_address.country_code',
      ],
      filters: { payment_collection: { id: session.payment_collection_id } },
    })
    // An order was already placed from this cart (another attempt succeeded).
    if (!cart?.email || cart.completed_at) return

    const eventId: string =
      input?.payload?.data?.id ?? `${sessionId}:${Math.floor(Date.now() / 60_000)}`

    await sendNotice(container, {
      template: 'payment-failed',
      to: cart.email,
      subject: 'Your payment did not go through',
      resourceId: cart.id,
      resourceType: 'cart',
      keySuffix: eventId,
      notice: {
        heading: 'Your payment did not go through',
        greeting: greetingFor(
          cart.customer?.first_name ?? cart.shipping_address?.first_name,
          cart.customer?.last_name ?? cart.shipping_address?.last_name
        ),
        paragraphs: [
          'We could not process your payment, so your order has not been placed. You have not been charged.',
          'Your items are still in your cart. Please try again, or use a different payment method.',
        ],
        rows: [{ label: 'Amount', value: formatMoney(session.amount ?? cart.total, cart.currency_code) }],
        button: { label: 'Return to your cart', url: cartUrl(cart.shipping_address?.country_code) },
      },
    })
  } catch (error: any) {
    console.error('Error handling payment failure email:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: PaymentWebhookEvents.WebhookReceived,
  context: { subscriberId: 'payment-failed-email' },
}
