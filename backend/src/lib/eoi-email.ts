import { formatMoney, greetingFor, orderLabel } from './email-notice'
import { toNumber } from './money'
import type { NoticeTemplateProps } from '../modules/email-notifications/templates/notice'

/** Order lines that are reservations (expressions of interest), not full purchases. */
export const eoiItemsOf = (order: any): any[] =>
  ((order?.items ?? []) as any[]).filter((item) => item?.metadata?.is_eoi === true)

/**
 * The reservation email. An EOI order pays only a deposit, so the generic
 * "order confirmation" misleads: it reads as if the item was bought in full.
 *
 * The balance is NOT collected by this system yet, so the email must not
 * promise a payment link. It states the balance and says the seller will be in
 * touch about it.
 */
export const buildEoiNotice = (order: any, eoiItems: any[]): NoticeTemplateProps => {
  const currency = order.currency_code
  const name = [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(' ')

  const deposit = eoiItems.reduce((sum, item) => sum + toNumber(item.metadata?.eoi_charged_amount ?? item.unit_price), 0)
  const balance = eoiItems.reduce((sum, item) => sum + toNumber(item.metadata?.eoi_remaining_amount), 0)

  return {
    heading: 'Your reservation is confirmed',
    greeting: greetingFor(name),
    paragraphs: [
      `Thank you. We have taken your deposit and reserved your place (order ${orderLabel(order)}).`,
      balance > 0
        ? 'This was a deposit, not the full price. The remaining balance has not been charged, and the seller will contact you about it.'
        : 'This was a deposit. The seller will contact you about the next steps.',
    ],
    rows: [
      { label: 'Order', value: orderLabel(order) },
      { label: 'Deposit paid', value: formatMoney(deposit, currency) },
      ...(balance > 0 ? [{ label: 'Remaining balance (not yet charged)', value: formatMoney(balance, currency) }] : []),
    ],
    items: eoiItems.map((item) => ({
      name: String(item.title ?? item.product_title ?? 'Item'),
      quantity: String(toNumber(item.quantity)),
      total: `Deposit ${formatMoney(item.metadata?.eoi_charged_amount ?? item.unit_price, currency)}`,
    })),
  }
}
