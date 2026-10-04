import { Text, Hr, Heading, Button, Section } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const APPOINTMENT_CHANGED = 'appointment-changed'

export interface AppointmentChangedTemplateProps {
  /** What happened to the booking. Both variants go to the buyer. */
  kind: 'cancelled' | 'rescheduled'
  appointment: {
    service: string
    resource: string
    business: string
    /** Current slot start/end as ISO strings (for a cancel, the slot that was cancelled). */
    start: string
    end: string
    /** IANA zone the slot is shown in (the resource's own timezone). */
    timezone: string
  }
  buyerName?: string | null
  /** Rescheduled only: the time the booking had before the move. */
  previousStart?: string | null
  /** Who made the change, shown as "by the business" or "by you". */
  changedBy: 'buyer' | 'vendor' | 'admin' | 'system'
  /** Cancelled only: the reason the business gave, if any. */
  reason?: string | null
  /** Rescheduled only: signed link to manage the booking again. */
  manageUrl?: string | null
  manageDeadline?: string | null
  /** Cancelled only: link back to book another time. */
  bookUrl?: string | null
  preview?: string
}

export const isAppointmentChangedData = (
  data: any
): data is AppointmentChangedTemplateProps =>
  typeof data?.appointment === 'object' &&
  data.appointment !== null &&
  typeof data.appointment.start === 'string' &&
  (data.kind === 'cancelled' || data.kind === 'rescheduled')

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

export const AppointmentChangedTemplate: React.FC<AppointmentChangedTemplateProps> & {
  PreviewProps: AppointmentChangedTemplateProps
} = ({
  kind,
  appointment,
  buyerName,
  previousStart,
  changedBy,
  reason,
  manageUrl,
  manageDeadline,
  bookUrl,
  preview
}) => {
  const tz = appointment.timezone
  const cancelled = kind === 'cancelled'
  const who = changedBy === 'buyer' ? 'by you' : `by ${appointment.business || 'the business'}`
  const when = `${formatInZone(appointment.start, tz)} - ${formatInZone(appointment.end, tz, false)}`

  return (
    <Base
      preview={
        preview ??
        (cancelled
          ? `Your appointment with ${appointment.business} was cancelled`
          : `Your appointment with ${appointment.business} has a new time`)
      }
    >
      <Heading className="text-2xl font-semibold text-center mb-2">
        {cancelled ? 'Your appointment was cancelled' : 'Your appointment has a new time'}
      </Heading>

      <Text className="text-center text-[#666] mt-0">
        {appointment.service} with {appointment.resource}
        <br />
        {appointment.business}
      </Text>

      <Hr className="my-[20px]" />

      <Section className="border border-solid border-[#eaeaea] rounded p-[16px] text-center">
        {cancelled ? (
          <Text className="font-semibold text-lg m-0 line-through text-[#999]">{when}</Text>
        ) : (
          <>
            {previousStart ? (
              <Text className="m-0 text-[#999] line-through">
                {formatInZone(previousStart, tz)}
              </Text>
            ) : null}
            <Text className="font-semibold text-lg m-0">{when}</Text>
          </>
        )}
        <Text className="m-0 text-[#666]">Times shown in {tz}</Text>
      </Section>

      <Text>
        {buyerName ? `Hi ${buyerName}, ` : 'Hi, '}
        {cancelled
          ? `your booking was cancelled ${who}.`
          : `your booking was moved ${who}. You will not be charged again.`}
      </Text>

      {cancelled && reason ? (
        <Text>
          <strong>Reason:</strong> {reason}
        </Text>
      ) : null}

      {cancelled ? (
        <>
          <Text className="text-[#666]">
            If you paid online, {appointment.business || 'the business'} will arrange any
            refund. Reply to this email to contact them.
          </Text>
          {bookUrl ? (
            <Section className="text-center my-[16px]">
              <Button
                href={bookUrl}
                className="bg-[#111] rounded text-white text-[14px] px-[20px] py-[12px]"
              >
                Book another time
              </Button>
            </Section>
          ) : null}
        </>
      ) : manageUrl ? (
        <Section className="text-center my-[16px]">
          <Button
            href={manageUrl}
            className="bg-[#111] rounded text-white text-[14px] px-[20px] py-[12px]"
          >
            Manage this booking
          </Button>
          {manageDeadline ? (
            <Text className="text-[#666] text-[12px]">
              You can change or cancel online until {formatInZone(manageDeadline, tz)}.
            </Text>
          ) : null}
        </Section>
      ) : null}
    </Base>
  )
}

AppointmentChangedTemplate.PreviewProps = {
  kind: 'rescheduled',
  appointment: {
    service: 'Deep tissue massage',
    resource: 'Room 2',
    business: 'Glow Studio',
    start: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    end: new Date(Date.now() + 3 * 86_400_000 + 60 * 60_000).toISOString(),
    timezone: 'Asia/Kolkata'
  },
  buyerName: 'Asha',
  previousStart: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  changedBy: 'vendor',
  manageUrl: 'https://example.com/appointments/booking/abc',
  manageDeadline: new Date(Date.now() + 2 * 86_400_000).toISOString()
} as AppointmentChangedTemplateProps

export default AppointmentChangedTemplate
