import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { STOREFRONT_URL } from '../lib/constants'
import { formatDate, formatMoney, greetingFor, sendNotice } from '../lib/email-notice'

type Payload = { id: string; status: string }

/**
 * Emails the renter when their rental starts, when it is returned, and when the
 * security deposit is settled (refunded, partly refunded or forfeited).
 *
 * A cancelled rental is not emailed here: rentals are cancelled when their order
 * is, and the order-cancelled email already tells the buyer.
 */
export default async function rentalEmailHandler({ event, container }: SubscriberArgs<Payload>) {
  try {
    const { id, status } = event.data
    const isDeposit = event.name === 'rental.deposit_changed'

    if (!isDeposit && !['active', 'returned'].includes(status)) return
    if (isDeposit && !['refunded', 'partially_refunded', 'forfeited'].includes(status)) return

    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [rental],
    } = await query.graph({
      entity: 'rental',
      fields: [
        'id',
        'customer_id',
        'order_id',
        'variant_id',
        'rental_start_date',
        'rental_end_date',
        'security_deposit_amount',
      ],
      filters: { id },
    })
    if (!rental?.customer_id) return

    const [{ data: customers }, { data: variants }, { data: orders }] = await Promise.all([
      query.graph({ entity: 'customer', fields: ['id', 'email', 'first_name', 'last_name'], filters: { id: rental.customer_id } }),
      query.graph({ entity: 'variant', fields: ['id', 'product.title'], filters: { id: rental.variant_id } }),
      rental.order_id
        ? query.graph({ entity: 'order', fields: ['id', 'currency_code'], filters: { id: rental.order_id } })
        : Promise.resolve({ data: [] as any[] }),
    ])
    const customer = customers?.[0]
    if (!customer?.email) return

    const item = variants?.[0]?.product?.title ?? 'your rental'
    const currency = orders?.[0]?.currency_code
    const deposit = formatMoney(rental.security_deposit_amount, currency)
    const greeting = greetingFor(customer.first_name, customer.last_name)
    const accountUrl = `${STOREFRONT_URL}/${(process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb').toLowerCase()}/account/orders`

    if (!isDeposit) {
      const active = status === 'active'
      await sendNotice(container, {
        template: active ? 'rental-activated' : 'rental-returned',
        to: customer.email,
        subject: active ? `Your rental of ${item} has started` : `We received your return of ${item}`,
        resourceId: rental.id,
        resourceType: 'rental',
        notice: {
          heading: active ? 'Your rental has started' : 'Your rental was returned',
          greeting,
          paragraphs: active
            ? [`Your rental of ${item} is now active. Please return it on time to get your deposit back in full.`]
            : [`Thank you for returning ${item}. We will settle your security deposit and email you when that is done.`],
          rows: [
            { label: 'Item', value: item },
            { label: active ? 'Return by' : 'Rental period ended', value: formatDate(rental.rental_end_date) },
            ...(active ? [{ label: 'Security deposit held', value: deposit }] : []),
          ],
          button: { label: 'View your orders', url: accountUrl },
        },
      })
      return
    }

    const outcome: Record<string, [string, string]> = {
      refunded: ['Your deposit was refunded', 'Your security deposit has been refunded in full.'],
      partially_refunded: ['Part of your deposit was refunded', 'Part of your security deposit has been refunded. The rest was kept, for example for damage or late return.'],
      forfeited: ['Your deposit was kept', 'Your security deposit was kept in full, for example for damage or a missed return.'],
    }
    const [heading, line] = outcome[status]

    await sendNotice(container, {
      template: 'rental-deposit-update',
      to: customer.email,
      subject: `${heading} (${item})`,
      resourceId: rental.id,
      resourceType: 'rental',
      keySuffix: status,
      notice: {
        heading,
        greeting,
        paragraphs: [line, 'If you have questions about this, reply to this email.'],
        rows: [
          { label: 'Item', value: item },
          { label: 'Deposit', value: deposit },
        ],
        button: { label: 'View your orders', url: accountUrl },
      },
    })
  } catch (error: any) {
    console.error(`Error handling ${event.name} email:`, error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: ['rental.status_changed', 'rental.deposit_changed'],
  context: { subscriberId: 'rental-email' },
}
