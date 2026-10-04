import { Modules } from '@medusajs/framework/utils'
import { IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { sendEmail } from '../lib/send-email'
import { buildEoiNotice, eoiItemsOf } from '../lib/eoi-email'
import { sendNotice } from '../lib/email-notice'

async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
  
  const order = await orderModuleService.retrieveOrder(data.id, { relations: ['items', 'summary', 'shipping_address'] })

  // Digital orders have no shipping address at all. This used to read
  // `order.shipping_address.id` unguarded and outside the try block, so such an
  // order threw here and the confirmation email was never sent.
  let shippingAddress = order.shipping_address ?? null

  if (!shippingAddress && (order as any).shipping_address_id) {
    try {
      shippingAddress = await (orderModuleService as any).orderAddressService_?.retrieve(
        (order as any).shipping_address_id
      )
    } catch (error) {
      console.error('Could not load the shipping address for order', order.id, error)
    }
  }

  // A reservation (EOI) order pays only a deposit. Its own email says so and
  // names the balance; when EVERY line is a reservation that email replaces the
  // generic "order confirmation", otherwise both are sent.
  const eoiItems = eoiItemsOf(order)
  const eoiOnly = eoiItems.length > 0 && eoiItems.length === (order.items ?? []).length

  if (eoiItems.length) {
    await sendNotice(container, {
      template: 'eoi-confirmation',
      to: order.email,
      subject: 'Your reservation is confirmed',
      resourceId: order.id,
      resourceType: 'order',
      notice: buildEoiNotice(order, eoiItems),
    })
  }

  if (eoiOnly) return

  await sendEmail(container, {
    template: EmailTemplates.ORDER_PLACED,
    to: order.email,
    subject: 'Your order has been placed',
    idempotencyKey: `order-placed:${order.id}`,
    resourceId: order.id,
    resourceType: 'order',
    data: {
      order,
      shippingAddress,
      preview: 'Thank you for your order!'
    }
  })
}

/**
 * Whatever goes wrong while preparing the email (a record deleted since the
 * event, a failed lookup) must not surface as an unhandled error in the event
 * bus: the order, invite or reply that triggered this has already succeeded.
 */
export default async function orderPlacedHandlerSafe(args: Parameters<typeof orderPlacedHandler>[0]) {
  try {
    await orderPlacedHandler(args)
  } catch (error: any) {
    console.error('Error sending order confirmation:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed'
}
