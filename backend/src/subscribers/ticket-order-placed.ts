import { Modules } from '@medusajs/framework/utils'
import { INotificationModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { RESEND_FROM_EMAIL } from '../lib/constants'
import { TICKET_BOOKING_MODULE } from '../modules/ticket-booking'
import TicketBookingModuleService from '../modules/ticket-booking/service'

/**
 * Emails QR-coded tickets once an order containing them is placed.
 *
 * Deliberately a separate subscriber from order-placed.ts rather than an
 * addition to it: both listen to order.placed, and Medusa runs every
 * subscriber registered for an event. An order with no tickets exits here
 * immediately and only receives the standard confirmation.
 */
export default async function ticketOrderPlacedHandler({
  event: { data },
  container
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve('query')
  const notificationModuleService: INotificationModuleService =
    container.resolve(Modules.NOTIFICATION)
  const ticketBookingModuleService: TicketBookingModuleService =
    container.resolve(TICKET_BOOKING_MODULE)

  const {
    data: [order]
  } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'email',
      'customer.first_name',
      'customer.last_name',
      'billing_address.first_name',
      'billing_address.last_name',
      'ticket_purchases.id',
      'ticket_purchases.seat_number',
      'ticket_purchases.show_date',
      'ticket_purchases.venue_row.row_number',
      'ticket_purchases.venue_row.row_type',
      'ticket_purchases.ticket_product.product.title',
      'ticket_purchases.ticket_product.venue.name',
      'ticket_purchases.ticket_product.venue.address'
    ],
    filters: { id: data.id }
  })

  const ticketPurchases = (order?.ticket_purchases || []).filter(Boolean) as any[]

  // Not a ticket order: the standard confirmation email covers it.
  if (!ticketPurchases.length) {
    return
  }

  try {
    const qrCodes = await ticketBookingModuleService.generateTicketQRCodes(
      ticketPurchases.map((purchase) => purchase.id)
    )

    const firstPurchase = ticketPurchases[0]
    const customerName = [
      order.customer?.first_name ?? order.billing_address?.first_name,
      order.customer?.last_name ?? order.billing_address?.last_name
    ]
      .filter(Boolean)
      .join(' ')

    await notificationModuleService.createNotifications({
      to: order.email ?? '',
      channel: 'email',
      template: EmailTemplates.TICKET_ORDER_PLACED,
      data: {
        emailOptions: {
          replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
          subject: `Your tickets for ${
            firstPurchase?.ticket_product?.product?.title ?? 'your event'
          }`
        },
        show: {
          name: firstPurchase?.ticket_product?.product?.title ?? 'Your event',
          date: firstPurchase?.show_date,
          venue: firstPurchase?.ticket_product?.venue?.name ?? '',
          address: firstPurchase?.ticket_product?.venue?.address
        },
        tickets: ticketPurchases.map((purchase) => ({
          label: String(purchase.venue_row?.row_type ?? '').toUpperCase(),
          row: purchase.venue_row?.row_number ?? '',
          seat: purchase.seat_number,
          qr: qrCodes[purchase.id] ?? ''
        })),
        order: {
          display_id: order.display_id ?? order.id,
          email: order.email
        },
        customerName: customerName || undefined,
        preview: 'Your tickets are attached below'
      }
    })
  } catch (error) {
    // Mirrors the standard order-placed subscriber: a failed email must not
    // fail the order, which has already been paid for at this point.
    console.error('Error sending ticket confirmation notification:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed'
}
