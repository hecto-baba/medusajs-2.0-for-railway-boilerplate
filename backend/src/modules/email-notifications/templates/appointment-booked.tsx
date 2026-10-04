import { Text, Hr, Heading, Button, Section } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const APPOINTMENT_BOOKED = 'appointment-booked'

export interface AppointmentBookedTemplateProps {
  /** "buyer" gets the confirmation and a cancel link; "vendor" gets a heads-up. */
  audience: 'buyer' | 'vendor'
  appointment: {
    service: string
    resource: string
    business: string
    /** Slot start/end as ISO strings. */
    start: string
    end: string
    /** IANA zone the slot is shown in (the resource's own timezone). */
    timezone: string
  }
  buyerName?: string | null
  buyerEmail?: string | null
  buyerPhone?: string | null
  notes?: string | null
  order: { display_id: string | number }
  /** Signed link that cancels this one booking; only sent to the buyer. */
  cancelUrl?: string | null
  cancelDeadline?: string | null
  preview?: string
}

export const isAppointmentBookedData = (
  data: any
): data is AppointmentBookedTemplateProps =>
  typeof data?.appointment === 'object' &&
  data.appointment !== null &&
  typeof data.appointment.start === 'string' &&
  (data.audience === 'buyer' || data.audience === 'vendor')

const formatInZone = (value: string, timeZone: string, withDate = true): string => {
  const date = new Date(value)
  if (isNaN(date.valueOf())) return value
  try {
    return date.toLocaleString('en-US', {
      timeZone,
      ...(withDate
        ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        : {}),
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return date.toISOString()
  }
}

export const AppointmentBookedTemplate: React.FC<AppointmentBookedTemplateProps> & {
  PreviewProps: AppointmentBookedTemplateProps
} = ({
  audience,
  appointment,
  buyerName,
  buyerEmail,
  buyerPhone,
  notes,
  order,
  cancelUrl,
  cancelDeadline,
  preview
}) => {
  const when = `${formatInZone(appointment.start, appointment.timezone)} - ${formatInZone(
    appointment.end,
    appointment.timezone,
    false
  )}`

  return (
    <Base
      preview={
        preview ??
        (audience === 'buyer'
          ? `Your appointment with ${appointment.business} is confirmed`
          : `New booking: ${appointment.service}`)
      }
    >
      <Heading className="text-2xl font-semibold text-center mb-2">
        {audience === 'buyer' ? 'Your appointment is confirmed' : 'New booking'}
      </Heading>

      <Text className="text-center text-[#666] mt-0">
        {appointment.service} with {appointment.resource}
        <br />
        {appointment.business}
      </Text>

      <Hr className="my-[20px]" />

      <Section className="border border-solid border-[#eaeaea] rounded p-[16px] text-center">
        <Text className="font-semibold text-lg m-0">{when}</Text>
        <Text className="m-0 text-[#666]">Times shown in {appointment.timezone}</Text>
      </Section>

      {audience === 'vendor' ? (
        <>
          <Text className="mb-0">
            <strong>Customer:</strong> {buyerName || 'Guest'}
          </Text>
          {buyerEmail ? <Text className="my-0">{buyerEmail}</Text> : null}
          {buyerPhone ? <Text className="my-0">{buyerPhone}</Text> : null}
          {notes ? (
            <Text>
              <strong>Notes:</strong> {notes}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text>
            {buyerName ? `Hi ${buyerName}, ` : 'Hi, '}
            your booking is confirmed. We look forward to seeing you.
          </Text>
          {cancelUrl ? (
            <Section className="text-center my-[16px]">
              <Button
                href={cancelUrl}
                className="bg-[#111] rounded text-white text-[14px] px-[20px] py-[12px]"
              >
                Manage or cancel this booking
              </Button>
              {cancelDeadline ? (
                <Text className="text-[#666] text-[12px]">
                  You can cancel online until{' '}
                  {formatInZone(cancelDeadline, appointment.timezone)}.
                </Text>
              ) : null}
            </Section>
          ) : null}
        </>
      )}

      <Hr className="my-[20px]" />

      <Text className="text-[#666] text-[12px]">Order {order.display_id}</Text>
    </Base>
  )
}

AppointmentBookedTemplate.PreviewProps = {
  audience: 'buyer',
  appointment: {
    service: 'Haircut',
    resource: 'Priya Sharma',
    business: 'Glow Salon',
    start: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    end: new Date(Date.now() + 3 * 86_400_000 + 45 * 60_000).toISOString(),
    timezone: 'Asia/Kolkata'
  },
  buyerName: 'Alex',
  order: { display_id: 1042 },
  cancelUrl: 'https://example.com/appointments/cancel',
  cancelDeadline: new Date(Date.now() + 2 * 86_400_000).toISOString()
} as AppointmentBookedTemplateProps

export default AppointmentBookedTemplate
