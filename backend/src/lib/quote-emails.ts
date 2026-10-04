import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { MedusaContainer } from '@medusajs/framework/types'
import { STOREFRONT_URL } from './constants'
import { formatMoney, greetingFor, noticeKey, sendNotice } from './email-notice'
import { findSentBaseKeys } from './send-email'
import { loadVendorsForProducts, platformFallback } from './vendor-recipients'
import type { NoticeTemplateProps } from '../modules/email-notifications/templates/notice'

/**
 * Quote emails.
 *
 * A quote changes state in about fifteen places (store, admin and vendor routes,
 * five workflows, two fallbacks). Rather than patch each, this looks at a
 * quote's CURRENT state and sends the email that state calls for. Every email has
 * an idempotency key built from the quote and the state, so looking at the same
 * state twice sends once, and a state whose send failed is retried on the next
 * look. A job runs it every minute over recently changed quotes.
 *
 *   pending_merchant   -> vendor: quote-requested        buyer: copy
 *   pending_customer   -> buyer:  quote-sent
 *   accepted           -> vendor + buyer: quote-accepted
 *   customer_rejected  -> vendor: quote-rejected
 *   merchant_rejected  -> buyer:  quote-rejected
 *   paid / shipped / delivered (set on accepted quotes) -> buyer: quote-status-update
 */

const QUOTE_FIELDS = [
  'id',
  'status',
  'customer_id',
  'draft_order_id',
  'cart_id',
  'metadata',
  'updated_at',
  'customer.email',
  'customer.first_name',
  'customer.last_name',
  'draft_order.email',
  'cart.email',
  'cart.currency_code',
  'cart.items.title',
  'cart.items.quantity',
  'cart.items.product_id',
]

const quotesUrl = (): string => `${STOREFRONT_URL}/${(process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb').toLowerCase()}/account/quotes`

const itemsOf = (quote: any) =>
  (((quote.metadata?.items_negotiated as any[] | undefined) ?? quote.cart?.items ?? []) as any[]).map((item) => ({
    name: String(item.title ?? 'Item'),
    quantity: String(item.quantity ?? 1),
  }))

const negotiatedTotal = (quote: any): number | null => {
  const negotiated = quote.metadata?.items_negotiated
  if (!Array.isArray(negotiated) || !negotiated.length) return null
  const items = negotiated.reduce((sum, it) => sum + Number(it.quantity || 1) * Number(it.unit_price || 0), 0)
  return items + Number(quote.metadata?.admin_shipping_price ?? 0)
}

const label = (quote: any): string => `Quote ${String(quote.id).slice(-8).toUpperCase()}`

type Mail = { to: string; template: Parameters<typeof sendNotice>[1]['template']; subject: string; notice: NoticeTemplateProps; keySuffix: string }

/** Pure: which emails a quote in this state needs. No I/O, so it is easy to test. */
export const quoteEmailsFor = (
  quote: any,
  recipients: { buyer: string | null; buyerName: string; vendorEmails: string[] }
): Mail[] => {
  const mails: Mail[] = []
  const buyer = recipients.buyer
  const name = label(quote)
  const items = itemsOf(quote)
  const buyerGreeting = greetingFor(recipients.buyerName)
  const forVendors = (build: (to: string) => Omit<Mail, 'to'>) =>
    recipients.vendorEmails.forEach((to) => mails.push({ to, ...build(to) }))
  const forBuyer = (build: Omit<Mail, 'to'>) => buyer && mails.push({ to: buyer, ...build })

  const status = quote.status as string

  if (status === 'pending_merchant') {
    forVendors(() => ({
      template: 'quote-requested',
      subject: `New quote request: ${name}`,
      keySuffix: 'vendor',
      notice: {
        heading: 'You have a new quote request',
        paragraphs: ['A buyer has asked for a quote on your products. Open it in your dashboard to set a price and reply.'],
        rows: [{ label: 'Quote', value: name }],
        items,
      },
    }))
    forBuyer({
      template: 'quote-requested',
      subject: `We received your quote request (${name})`,
      keySuffix: 'buyer',
      notice: {
        heading: 'We received your quote request',
        greeting: buyerGreeting,
        paragraphs: ['The seller has been told and will come back to you with a price. We will email you as soon as they do.'],
        rows: [{ label: 'Quote', value: name }],
        items,
        button: { label: 'View your quotes', url: quotesUrl() },
      },
    })
  }

  if (status === 'pending_customer') {
    const total = negotiatedTotal(quote)
    forBuyer({
      template: 'quote-sent',
      subject: `Your quote is ready (${name})`,
      keySuffix: 'sent',
      notice: {
        heading: 'Your quote is ready',
        greeting: buyerGreeting,
        paragraphs: ['The seller has sent you their price. Review it and accept or decline.'],
        rows: [
          { label: 'Quote', value: name },
          ...(total !== null ? [{ label: 'Total', value: formatMoney(total, quote.cart?.currency_code) }] : []),
        ],
        items,
        button: { label: 'Review your quote', url: quotesUrl() },
      },
    })
  }

  if (status === 'accepted') {
    forVendors(() => ({
      template: 'quote-accepted',
      subject: `Quote accepted: ${name}`,
      keySuffix: 'vendor',
      notice: {
        heading: 'A quote was accepted',
        paragraphs: ['The buyer accepted your quote. It is now an order in your dashboard.'],
        rows: [{ label: 'Quote', value: name }],
        items,
      },
    }))
    forBuyer({
      template: 'quote-accepted',
      subject: `You accepted ${name}`,
      keySuffix: 'buyer',
      notice: {
        heading: 'Quote accepted',
        greeting: buyerGreeting,
        paragraphs: ['You accepted the seller\'s quote. The seller will now arrange payment and delivery with you.'],
        rows: [{ label: 'Quote', value: name }],
        items,
        button: { label: 'View your quote', url: quotesUrl() },
      },
    })

    const meta = quote.metadata ?? {}
    const steps: Array<[boolean, string, string, string]> = [
      [meta.payment_status === 'paid', 'paid', 'Payment recorded', 'The seller has recorded your payment for this quote.'],
      [meta.fulfillment_status === 'shipped', 'shipped', 'Your order is on its way', 'The seller has dispatched your order.'],
      [meta.fulfillment_status === 'delivered', 'delivered', 'Your order was delivered', 'The seller has marked your order as delivered.'],
    ]
    for (const [reached, key, heading, line] of steps) {
      if (!reached) continue
      forBuyer({
        template: 'quote-status-update',
        subject: `${heading} (${name})`,
        keySuffix: key,
        notice: {
          heading,
          greeting: buyerGreeting,
          paragraphs: [line],
          rows: [{ label: 'Quote', value: name }],
          button: { label: 'View your quote', url: quotesUrl() },
        },
      })
    }
  }

  if (status === 'customer_rejected') {
    forVendors(() => ({
      template: 'quote-rejected',
      subject: `Quote declined: ${name}`,
      keySuffix: 'vendor',
      notice: {
        heading: 'A quote was declined',
        paragraphs: ['The buyer declined your quote.'],
        rows: [{ label: 'Quote', value: name }],
      },
    }))
  }

  if (status === 'merchant_rejected') {
    forBuyer({
      template: 'quote-rejected',
      subject: `Your quote request was declined (${name})`,
      keySuffix: 'buyer',
      notice: {
        heading: 'Your quote request was declined',
        greeting: buyerGreeting,
        paragraphs: ['The seller is not able to quote on this request. You are welcome to request another quote or browse other products.'],
        rows: [{ label: 'Quote', value: name }],
        button: { label: 'View your quotes', url: quotesUrl() },
      },
    })
  }

  return mails
}

/**
 * Looks at quotes changed in the last `windowMinutes` and sends what is due.
 *
 * Built to be cheap when nothing is due, because it runs every minute:
 *  - one query for the quotes, one for who owns their products, one for those
 *    owners' emails (never per quote);
 *  - one query for what has already been sent, so finished emails are dropped
 *    before any per-email work;
 *  - never throws.
 */
export const sendRecentQuoteEmails = async (container: MedusaContainer, windowMinutes = 30): Promise<number> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const since = new Date(Date.now() - windowMinutes * 60_000)
  const { data: quotes } = await query.graph({
    entity: 'quote',
    fields: QUOTE_FIELDS,
    filters: { updated_at: { $gte: since } },
  })
  if (!quotes?.length) return 0

  const productIds = (quotes as any[]).flatMap((q) => ((q.cart?.items ?? []) as any[]).map((i) => i.product_id)).filter(Boolean)
  const extraVendorIds = (quotes as any[]).map((q) => q.metadata?.vendor_id).filter(Boolean)
  const { sellerOf, recipients } = await loadVendorsForProducts(container, productIds, extraVendorIds)
  const alreadySent = await findSentBaseKeys(container, {
    resource_type: 'quote',
    resource_ids: (quotes as any[]).map((q) => q.id),
  })

  let sent = 0
  for (const quote of quotes as any[]) {
    try {
      const vendorIds = new Set<string>(
        ((quote.cart?.items ?? []) as any[]).map((i) => sellerOf.get(i.product_id)).filter(Boolean) as string[]
      )
      if (quote.metadata?.vendor_id) vendorIds.add(quote.metadata.vendor_id)
      const vendorEmails = [...vendorIds].flatMap((id) => recipients.get(id)?.emails ?? [])

      const mails = quoteEmailsFor(quote, {
        buyer: quote.customer?.email ?? quote.draft_order?.email ?? quote.cart?.email ?? null,
        buyerName: [quote.customer?.first_name, quote.customer?.last_name].filter(Boolean).join(' '),
        vendorEmails: vendorEmails.length ? vendorEmails : platformFallback(),
      })

      for (const mail of mails) {
        const keySuffix = `${quote.status}:${mail.keySuffix}:${mail.to}`
        if (alreadySent.has(noticeKey(mail.template, quote.id, keySuffix))) continue

        const result = await sendNotice(container, {
          template: mail.template,
          to: mail.to,
          subject: mail.subject,
          notice: mail.notice,
          resourceId: quote.id,
          resourceType: 'quote',
          keySuffix,
        })
        if (result === 'sent') sent++
      }
    } catch (error: any) {
      console.error(`Could not send emails for quote ${quote.id}:`, error?.message ?? error)
    }
  }
  return sent
}
