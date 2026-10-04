import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { sendNotice } from '../lib/email-notice'
import { loadProductVendorRecipients } from '../lib/vendor-recipients'

/**
 * A shopper has asked a question about a product. Tells the product's seller
 * (the login email of each of their admins), or the platform operator when the
 * product has no seller, and sends the shopper a short acknowledgement.
 *
 * The acknowledgement is sent only to signed-in customers: a guest's address is
 * unverified, so acknowledging it would let anyone trigger an email to a stranger.
 */
export default async function enquiryCreatedEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [enquiry],
    } = await query.graph({
      entity: 'enquiry',
      fields: ['id', 'product_id', 'customer_id', 'customer_email', 'message', 'product.title'],
      filters: { id: data.id },
    })
    if (!enquiry) return

    const title = enquiry.product?.title ?? 'a product'
    const { vendors, fallback } = await loadProductVendorRecipients(container, [enquiry.product_id])
    const recipients = vendors.flatMap((v) => v.emails)

    for (const to of recipients.length ? recipients : fallback) {
      await sendNotice(container, {
        template: 'enquiry-received',
        to,
        subject: `New enquiry about ${title}`,
        resourceId: enquiry.id,
        resourceType: 'enquiry',
        keySuffix: to,
        notice: {
          heading: 'You have a new enquiry',
          paragraphs: [`A shopper has a question about ${title}. Open it in your dashboard to reply.`],
          rows: [{ label: 'Product', value: title }],
        },
      })
    }

    // Only for a signed-in customer. A guest's address is whatever they typed and
    // is not verified, so acknowledging it would let anyone make us email a stranger.
    if (enquiry.customer_id && enquiry.customer_email) {
      await sendNotice(container, {
        template: 'enquiry-acknowledged',
        to: enquiry.customer_email,
        subject: `We received your enquiry about ${title}`,
        resourceId: enquiry.id,
        resourceType: 'enquiry',
        notice: {
          heading: 'We received your enquiry',
          paragraphs: [`Thank you for your question about ${title}. The seller has been told and will reply to this email address.`],
        },
      })
    }
  } catch (error: any) {
    console.error('Error handling enquiry.created email:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: 'enquiry.created',
  context: { subscriberId: 'enquiry-created-email' },
}
