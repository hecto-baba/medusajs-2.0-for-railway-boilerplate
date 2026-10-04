import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { STOREFRONT_URL } from '../lib/constants'
import { sendEmail } from '../lib/send-email'
import { APPOINTMENT_BOOKING_MODULE } from '../modules/appointment-booking'
import type AppointmentBookingModuleService from '../modules/appointment-booking/service'
import { signCancelToken } from '../modules/appointment-booking/lib/cancel-token'

type ChangedEvent = { attendee_id: string; notify?: boolean }

/**
 * Tells the buyer when the business cancels their booking, and confirms a new
 * time after a reschedule. A buyer who cancels (or whose own reschedule this is)
 * already saw the result on screen, so a buyer-made cancel sends nothing; a
 * buyer-made reschedule still gets the email, because it carries their fresh
 * manage link.
 *
 * `notify: false` (the seller unticked the "email the customer" box) skips the
 * send. Each attendee is marked after its email goes out, so a redelivered event
 * cannot email twice; a failed send leaves it unmarked so a retry can try again,
 * and never fails the cancel or reschedule that emitted the event.
 */
const sendChangeEmail = async ({
  event: { name, data },
  container
}: SubscriberArgs<ChangedEvent>) => {
  if (data.notify === false) return

  const rescheduled = name === 'appointment.rescheduled'
  const service: AppointmentBookingModuleService = container.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const [attendee] = await service.listAppointmentAttendees({ id: data.attendee_id }, { take: 1 })
  if (!attendee) return

  const changedBy = rescheduled ? attendee.rescheduled_by : attendee.cancelled_by
  if (rescheduled ? attendee.reschedule_notified_at : attendee.cancellation_sent_at) return
  if (rescheduled ? attendee.status !== 'confirmed' : attendee.status !== 'cancelled') return
  if (!rescheduled && changedBy === 'buyer') return

  // Walk-ins entered by the seller may have no email on file.
  const to = attendee.buyer_email
  if (!to || !changedBy) return

  const appointment = await service.retrieveAppointment(attendee.appointment_id)
  const resource = await service.retrieveProvider(appointment.provider_id)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const [{ data: products }, { data: vendors }, { data: orders }] = await Promise.all([
    query.graph({ entity: 'product', fields: ['id', 'title'], filters: { id: appointment.service_product_id } }),
    resource.vendor_id
      ? query.graph({ entity: 'vendor', fields: ['id', 'name'], filters: { id: resource.vendor_id } })
      : Promise.resolve({ data: [] as any[] }),
    attendee.order_id
      ? query.graph({
          entity: 'order',
          fields: ['id', 'billing_address.country_code', 'shipping_address.country_code'],
          filters: { id: attendee.order_id }
        })
      : Promise.resolve({ data: [] as any[] })
  ])

  const order = (orders as any[])[0]
  const countryCode = String(
    order?.billing_address?.country_code ||
      order?.shipping_address?.country_code ||
      process.env.NEXT_PUBLIC_DEFAULT_REGION ||
      'gb'
  ).toLowerCase()

  const businessName = (vendors as any[])[0]?.name ?? ''
  const timezone = appointment.resource_timezone ?? resource.timezone
  const deadline = new Date(
    new Date(appointment.start_time).getTime() - resource.cancellation_window_hours * 3_600_000
  )

  try {
    // A reschedule can happen several times, so its key includes how many have
    // happened; a cancel happens once. A redelivered event sends nothing twice.
    const result = await sendEmail(container, {
      template: EmailTemplates.APPOINTMENT_CHANGED,
      to,
      subject: rescheduled
        ? `Your appointment with ${businessName || 'us'} has a new time`
        : `Your appointment with ${businessName || 'us'} was cancelled`,
      idempotencyKey: rescheduled
        ? `appointment-rescheduled:${attendee.id}:${attendee.reschedule_count ?? new Date(attendee.rescheduled_from_start ?? 0).getTime()}`
        : `appointment-cancelled:${attendee.id}`,
      resourceId: attendee.id,
      resourceType: 'appointment_attendee',
      data: {
        kind: rescheduled ? 'rescheduled' : 'cancelled',
        appointment: {
          service: (products as any[])[0]?.title ?? 'Appointment',
          resource: resource.display_name ?? 'Your appointment',
          business: businessName,
          start: new Date(appointment.start_time).toISOString(),
          end: new Date(appointment.end_time).toISOString(),
          timezone
        },
        buyerName: attendee.buyer_name,
        previousStart: rescheduled && attendee.rescheduled_from_start
          ? new Date(attendee.rescheduled_from_start).toISOString()
          : null,
        changedBy,
        reason: rescheduled ? null : attendee.cancel_reason,
        manageUrl: rescheduled
          ? `${STOREFRONT_URL}/${countryCode}/appointments/booking/${attendee.id}?token=${signCancelToken(attendee.id)}`
          : null,
        manageDeadline: rescheduled ? deadline.toISOString() : null,
        bookUrl: rescheduled ? null : `${STOREFRONT_URL}/${countryCode}/book`
      }
    })

    // Left unmarked when the send failed, so a redelivery tries again.
    if (result === 'failed') return

    await service.updateAppointmentAttendees({
      id: attendee.id,
      ...(rescheduled
        ? { reschedule_notified_at: new Date() }
        : { cancellation_sent_at: new Date() })
    })
  } catch (error) {
    console.error('Error sending appointment change notification:', error)
  }
}

/**
 * Whatever goes wrong here (a record deleted since the event, a failed lookup) must
 * never surface as an unhandled rejection: the cancel or reschedule that emitted
 * the event is already done, and the attendee stays unmarked so a redelivery can
 * try again.
 */
export default async function appointmentChangedHandler(args: SubscriberArgs<ChangedEvent>) {
  try {
    await sendChangeEmail(args)
  } catch (error) {
    console.error("Error handling appointment change notification:", error)
  }
}

export const config: SubscriberConfig = {
  event: ['appointment.cancelled', 'appointment.rescheduled']
}
