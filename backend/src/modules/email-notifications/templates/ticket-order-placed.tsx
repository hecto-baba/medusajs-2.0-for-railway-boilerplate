import { Text, Section, Hr, Img, Heading } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const TICKET_ORDER_PLACED = 'ticket-order-placed'

export interface TicketEmailData {
  /** Seating tier, e.g. "VIP" - shown as the ticket's headline label. */
  label: string
  row: string
  seat: string
  /** QR code as a data URI, produced by the ticket booking module. */
  qr: string
}

export interface TicketOrderPlacedTemplateProps {
  show: {
    name: string
    date: string
    venue: string
    address?: string | null
  }
  tickets: TicketEmailData[]
  order: {
    display_id: string | number
    email?: string | null
  }
  customerName?: string
  preview?: string
}

export const isTicketOrderPlacedData = (
  data: any
): data is TicketOrderPlacedTemplateProps =>
  typeof data?.show === 'object' &&
  data.show !== null &&
  Array.isArray(data?.tickets) &&
  data.tickets.length > 0

/**
 * Show dates are stored as timestamps but read as a day and time at the door,
 * so they are formatted here rather than printed raw.
 */
const formatShowDate = (value: string): string => {
  const date = new Date(value)

  if (isNaN(date.valueOf())) {
    return value
  }

  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export const TicketOrderPlacedTemplate: React.FC<TicketOrderPlacedTemplateProps> & {
  PreviewProps: TicketOrderPlacedTemplateProps
} = ({ show, tickets, order, customerName, preview }) => {
  return (
    <Base preview={preview ?? `Your tickets for ${show.name}`}>
      <Heading className="text-2xl font-semibold text-center mb-2">
        {show.name}
      </Heading>

      <Text className="text-center text-[#666] mt-0">
        {formatShowDate(show.date)}
        <br />
        {show.venue}
        {show.address ? (
          <>
            <br />
            {show.address}
          </>
        ) : null}
      </Text>

      <Hr className="my-[20px]" />

      <Text>
        {customerName ? `Hi ${customerName}, ` : 'Hi, '}
        your booking is confirmed. Present the QR code for each seat at the
        entrance - each one is scanned once, so please do not share them.
      </Text>

      {tickets.map((ticket, index) => (
        <Section
          key={`${ticket.row}-${ticket.seat}-${index}`}
          className="border border-solid border-[#eaeaea] rounded p-[16px] my-[12px] text-center"
        >
          <Text className="font-semibold text-lg m-0">{ticket.label}</Text>
          <Text className="m-0 text-[#666]">
            Row {ticket.row} &middot; Seat {ticket.seat}
          </Text>
          {ticket.qr ? (
            <Img
              src={ticket.qr}
              alt={`Ticket for row ${ticket.row}, seat ${ticket.seat}`}
              width="180"
              height="180"
              className="mx-auto mt-[12px]"
            />
          ) : null}
        </Section>
      ))}

      <Hr className="my-[20px]" />

      <Text className="text-[#666] text-[12px]">
        Order {order.display_id}
        {order.email ? ` &middot; ${order.email}` : ''}
      </Text>
    </Base>
  )
}

TicketOrderPlacedTemplate.PreviewProps = {
  show: {
    name: 'A Midsummer Night&apos;s Dream',
    date: new Date().toISOString(),
    venue: 'The Grand Theatre',
    address: '12 Playhouse Lane, London'
  },
  tickets: [
    { label: 'VIP', row: 'A', seat: '4', qr: '' },
    { label: 'VIP', row: 'A', seat: '5', qr: '' }
  ],
  order: { display_id: 1042, email: 'guest@example.com' },
  customerName: 'Alex'
} as TicketOrderPlacedTemplateProps

export default TicketOrderPlacedTemplate
