import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { sendEmail } from '../lib/send-email'

/**
 * Emails the customer once an admin (or, later, a vendor) replies to their
 * product enquiry. A second notification channel ("Baba Chat" or otherwise)
 * is added later as its own independent subscriber on the same event, the
 * same way order-placed.ts and ticket-order-placed.ts both independently
 * listen to order.placed - not a change to this file.
 */
async function enquiryRespondedHandler({
  event: { data },
  container
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve('query')

  const {
    data: [enquiry]
  } = await query.graph({
    entity: 'enquiry',
    fields: ['id', 'product_id', 'customer_email', 'message', 'reply', 'product.title'],
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
    // Name the seller who owns the product in the email ("<Seller> replied").
    // The event does not say who replied, so this is the product's owner,
    // whether the seller answered or an admin answered on their behalf. A
    // product with no seller falls back to the template's generic "We replied".
    // Inside the try: a failed lookup must not stop the email from going out.
    // One targeted read of this product's seller, not a scan of every seller.
    const {
      data: [owner]
    } = await query.graph({
      entity: 'product',
      fields: ['id', 'vendor.name'],
      filters: { id: enquiry.product_id }
    })
    const storeName = (owner as any)?.vendor?.name ?? undefined

    // One reply per enquiry (the respond workflow refuses a second one).
    await sendEmail(container, {
      template: EmailTemplates.ENQUIRY_RESPONDED,
      to: enquiry.customer_email,
      subject: `Re: your question about ${enquiry.product?.title ?? 'a product'}`,
      idempotencyKey: `enquiry-responded:${enquiry.id}`,
      resourceId: enquiry.id,
      resourceType: 'enquiry',
      data: {
        productTitle: enquiry.product?.title ?? 'this product',
        message: enquiry.message,
        reply: enquiry.reply,
        storeName,
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

/**
 * Whatever goes wrong while preparing the email (a record deleted since the
 * event, a failed lookup) must not surface as an unhandled error in the event
 * bus: the order, invite or reply that triggered this has already succeeded.
 */
export default async function enquiryRespondedHandlerSafe(args: Parameters<typeof enquiryRespondedHandler>[0]) {
  try {
    await enquiryRespondedHandler(args)
  } catch (error: any) {
    console.error('Error sending enquiry response notification:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: 'enquiry.responded'
}
