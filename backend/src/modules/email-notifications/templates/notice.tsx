import { Text, Section, Hr, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

/**
 * One layout for the many short status emails (payment, refund, cancellation,
 * quote steps, approvals, rentals, vendor alerts...). Each of them is the same
 * shape: a heading, a few sentences, an optional table of facts, an optional
 * list of items and an optional button. They are separate template KEYS so
 * each can be told apart in the notification log, but share this component.
 *
 * Everything is plain strings, built by the subscriber, so the template never
 * has to know about orders, quotes or vendors.
 */
export const NOTICE_TEMPLATES = [
  'payment-received',
  'payment-failed',
  'refund-issued',
  'order-cancelled',
  'booking-failed',
  'booking-failed-admin',
  'quote-requested',
  'quote-sent',
  'quote-accepted',
  'quote-rejected',
  'quote-status-update',
  'vendor-new-order',
  'restaurant-new-delivery',
  'enquiry-received',
  'enquiry-acknowledged',
  'approval-requested',
  'approval-decided',
  'rental-activated',
  'rental-returned',
  'rental-deposit-update',
  'eoi-confirmation',
  'digital-order-ready',
] as const

export type NoticeTemplateKey = (typeof NOTICE_TEMPLATES)[number]

export interface NoticeItem {
  name: string
  quantity?: string
  total?: string
}

export interface NoticeTemplateProps {
  heading: string
  greeting?: string
  paragraphs: string[]
  rows?: { label: string; value: string }[]
  /** A list of line items (vendor orders, quotes). */
  items?: NoticeItem[]
  button?: { label: string; url: string }
  footnote?: string
  preview?: string
}

const isString = (value: unknown): value is string => typeof value === 'string'

export const isNoticeData = (data: any): data is NoticeTemplateProps =>
  typeof data === 'object' &&
  data !== null &&
  isString(data.heading) &&
  Array.isArray(data.paragraphs) &&
  data.paragraphs.every(isString) &&
  (data.rows === undefined ||
    (Array.isArray(data.rows) && data.rows.every((r: any) => isString(r?.label) && isString(r?.value)))) &&
  (data.items === undefined ||
    (Array.isArray(data.items) && data.items.every((i: any) => isString(i?.name)))) &&
  (data.button === undefined || (isString(data.button?.label) && isString(data.button?.url)))

export const NoticeTemplate: React.FC<NoticeTemplateProps> & {
  PreviewProps: NoticeTemplateProps
} = ({ heading, greeting, paragraphs, rows, items, button, footnote, preview }) => {
  return (
    <Base preview={preview ?? heading}>
      <Section>
        <Text style={{ fontSize: '22px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 24px' }}>
          {heading}
        </Text>

        <Text style={{ margin: '0 0 15px' }}>{greeting ?? 'Hello,'}</Text>

        {paragraphs.map((paragraph, index) => (
          <Text key={index} style={{ margin: '0 0 15px' }}>
            {paragraph}
          </Text>
        ))}

        {rows?.length ? (
          <>
            <Hr style={{ margin: '20px 0' }} />
            {rows.map((row, index) => (
              <Text key={index} style={{ margin: '0 0 6px' }}>
                <strong>{row.label}:</strong> {row.value}
              </Text>
            ))}
          </>
        ) : null}

        {items?.length ? (
          <>
            <Hr style={{ margin: '20px 0' }} />
            {items.map((item, index) => (
              <Text key={index} style={{ margin: '0 0 6px' }}>
                {item.name}
                {item.quantity ? ` x ${item.quantity}` : ''}
                {item.total ? ` - ${item.total}` : ''}
              </Text>
            ))}
          </>
        ) : null}

        {button ? (
          <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
            <Button
              href={button.url}
              style={{
                backgroundColor: '#111827',
                color: '#ffffff',
                padding: '12px 22px',
                borderRadius: '6px',
                fontWeight: 'bold',
                textDecoration: 'none',
              }}
            >
              {button.label}
            </Button>
          </Section>
        ) : null}

        {footnote ? (
          <Text style={{ margin: '24px 0 0', fontSize: '13px', color: '#6b7280' }}>{footnote}</Text>
        ) : null}
      </Section>
    </Base>
  )
}

NoticeTemplate.PreviewProps = {
  heading: 'Your refund is on its way',
  greeting: 'Dear Alex,',
  paragraphs: ['We have refunded part of your order #1042.'],
  rows: [
    { label: 'Amount', value: '$12.00' },
    { label: 'Order', value: '#1042' },
  ],
  button: { label: 'View your order', url: 'https://example.com/account/orders' },
  footnote: 'Refunds usually reach your card within 3 to 5 business days.',
}
