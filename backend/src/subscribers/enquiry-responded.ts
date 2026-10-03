import { Modules } from '@medusajs/framework/utils'
import { INotificationModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { ZEPTOMAIL_FROM_EMAIL } from '../lib/constants'

/**
 * Emails the customer once an admin (or, later, a vendor) replies to their
 * product enquiry. A second notification channel ("Baba Chat" or otherwise)
 * is added later as its own independent subscriber on the same event, the
 * same way order-placed.ts and ticket-order-placed.ts both independently
 * listen to order.placed - not a change to this file.
 */
export default async function enquiryRespondedHandler({
  event: { data },
  container
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve('query')
  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)

  const {
    data: [enquiry]
  } = await query.graph({
    entity: 'enquiry',
    fields: ['id', 'customer_email', 'message', 'reply', 'product.title'],
    filters: { id: data.id }
  })

  if (!enquiry?.reply) {
    // Defensive: the event only fires after a successful reply, so this
    // should not happen, but a missing reply/customer_email means there is
    // nothing safe to email.
    console.error(`enquiry-responded subscriber: enquiry ${data.id} has no reply, skipping email`)
    return
  }

  try {
    await notificationModuleService.createNotifications({
      to: enquiry.customer_email,
      channel: 'email',
      template: EmailTemplates.ENQUIRY_RESPONDED,
      data: {
        emailOptions: {
          replyTo: process.env.ORDER_REPLY_TO_EMAIL || ZEPTOMAIL_FROM_EMAIL,
          subject: `Re: your question about ${enquiry.product?.title ?? 'a product'}`
        },
        productTitle: enquiry.product?.title ?? 'this product',
        message: enquiry.message,
        reply: enquiry.reply,
        preview: 'You have a reply to your product question'
      }
    })
  } catch (error) {
    // Mirrors every other subscriber in this codebase: a failed email must
    // never fail or roll back the admin's "respond" action, which has
    // already saved successfully at this point.
    console.error('Error sending enquiry response notification:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'enquiry.responded'
}
