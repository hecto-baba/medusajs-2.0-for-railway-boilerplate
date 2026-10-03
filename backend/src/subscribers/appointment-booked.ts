import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { INotificationModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { ZEPTOMAIL_FROM_EMAIL, STOREFRONT_URL } from '../lib/constants'
import { APPOINTMENT_BOOKING_MODULE } from '../modules/appointment-booking'
import type AppointmentBookingModuleService from '../modules/appointment-booking/service'
import { signCancelToken } from '../modules/appointment-booking/lib/cancel-token'

/**
 * Emails the buyer their confirmation (with a signed link to manage or cancel
 * the booking) and tells the business about the new booking.
 *
 * Listens to `appointment.booked`, which the completion workflow emits AFTER the
 * places are confirmed - not to `order.placed`, which fires from inside the core
 * cart completion, before the booking is confirmed.
 *
 * Events can be delivered more than once, so each attendee is marked
 * (confirmation_sent_at) once its emails are sent and is skipped afterwards. A
 * failed email never fails the order, which is already paid by this point; the
 * attendee is left unmarked so a later redelivery can retry it.
 */
export default async function appointmentBookedHandler({
  event: { data },
  container
}: SubscriberArgs<{ order_id: string }>) {
  const service: AppointmentBookingModuleService = container.resolve(
    APPOINTMENT_BOOKING_MODULE
  )
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notifications: INotificationModuleService = container.resolve(Modules.NOTIFICATION)

  const attendees = await service.listAppointmentAttendees(
    { order_id: data.order_id, status: 'confirmed', confirmation_sent_at: null },
    { take: null }
  )
  if (!attendees.length) return

  const appointments = await service.listAppointments(
    { id: [...new Set(attendees.map((a) => a.appointment_id))] },
    { take: null }
  )
  const appointmentById = new Map(appointments.map((a) => [a.id, a]))

  const resources = await service.listProviders(
    { id: [...new Set(appointments.map((a) => a.provider_id))] },
    { take: null }
  )
  const resourceById = new Map(resources.map((r) => [r.id, r]))

  const productIds = [...new Set(appointments.map((a) => a.service_product_id))]
  const vendorIds = [...new Set(resources.map((r) => r.vendor_id).filter((v): v is string => !!v))]

  const [{ data: products }, { data: vendors }, { data: orders }] = await Promise.all([
    productIds.length
      ? query.graph({ entity: 'product', fields: ['id', 'title'], filters: { id: productIds } })
      : Promise.resolve({ data: [] as any[] }),
    vendorIds.length
      ? query.graph({
          entity: 'vendor',
          fields: ['id', 'name', 'admins.email'],
          filters: { id: vendorIds }
        })
      : Promise.resolve({ data: [] as any[] }),
    query.graph({
      entity: 'order',
      fields: [
        'id',
        'display_id',
        'email',
        'billing_address.country_code',
        'shipping_address.country_code'
      ],
      filters: { id: data.order_id }
    })
  ])

  const productTitle = new Map((products as any[]).map((p) => [p.id, p.title as string]))
  const vendorById = new Map((vendors as any[]).map((v) => [v.id, v]))
  const order = (orders as any[])[0]

  const replyTo = process.env.ORDER_REPLY_TO_EMAIL || ZEPTOMAIL_FROM_EMAIL
  const sent: string[] = []

  // The storefront's routes are country-prefixed, so the link carries the
  // buyer's country explicitly instead of relying on a redirect.
  const countryCode = String(
    order?.billing_address?.country_code ||
      order?.shipping_address?.country_code ||
      process.env.NEXT_PUBLIC_DEFAULT_REGION ||
      'gb'
  ).toLowerCase()

  for (const attendee of attendees) {
    const appointment = appointmentById.get(attendee.appointment_id)
    const resource = appointment ? resourceById.get(appointment.provider_id) : undefined
    if (!appointment || !resource) continue

    const vendor = resource.vendor_id ? vendorById.get(resource.vendor_id) : undefined
    const timezone = appointment.resource_timezone ?? resource.timezone
    const base = {
      appointment: {
        service: productTitle.get(appointment.service_product_id) ?? 'Appointment',
        resource: resource.display_name ?? 'Your appointment',
        business: vendor?.name ?? '',
        start: new Date(appointment.start_time).toISOString(),
        end: new Date(appointment.end_time).toISOString(),
        timezone
      },
      buyerName: attendee.buyer_name,
      buyerEmail: attendee.buyer_email ?? order?.email,
      buyerPhone: attendee.buyer_phone,
      notes: attendee.notes,
      order: { display_id: order?.display_id ?? data.order_id }
    }

    try {
      const buyerEmail = attendee.buyer_email ?? order?.email
      if (buyerEmail) {
        const deadline = new Date(
          new Date(appointment.start_time).getTime() -
            resource.cancellation_window_hours * 3_600_000
        )
        await notifications.createNotifications({
          to: buyerEmail,
          channel: 'email',
          template: EmailTemplates.APPOINTMENT_BOOKED,
          data: {
            emailOptions: {
              replyTo,
              subject: `Your appointment with ${vendor?.name ?? 'us'} is confirmed`
            },
            audience: 'buyer',
            ...base,
            cancelUrl: `${STOREFRONT_URL}/${countryCode}/appointments/booking/${attendee.id}?token=${signCancelToken(attendee.id)}`,
            cancelDeadline: deadline.toISOString()
          }
        })
      }

      const vendorEmails = ((vendor?.admins ?? []) as any[])
        .map((a) => a?.email as string | undefined)
        .filter((e): e is string => !!e)

      for (const to of vendorEmails) {
        await notifications.createNotifications({
          to,
          channel: 'email',
          template: EmailTemplates.APPOINTMENT_BOOKED,
          data: {
            emailOptions: {
              replyTo,
              subject: `New booking: ${base.appointment.service}`
            },
            audience: 'vendor',
            ...base
          }
        })
      }

      sent.push(attendee.id)
    } catch (error) {
      // Leave the attendee unmarked so a redelivery can retry it.
      console.error('Error sending appointment confirmation notification:', error)
    }
  }

  if (sent.length) {
    await service.updateAppointmentAttendees(
      sent.map((id) => ({ id, confirmation_sent_at: new Date() }))
    )
  }
}

export const config: SubscriberConfig = {
  event: 'appointment.booked'
}
