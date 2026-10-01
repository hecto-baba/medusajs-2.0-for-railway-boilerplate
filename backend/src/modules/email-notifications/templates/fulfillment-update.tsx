import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const FULFILLMENT_UPDATE = 'fulfillment-update'

export interface FulfillmentUpdateTemplateProps {
  /** "shipped" when a seller marks a parcel shipped, "delivered" when it arrives. */
  kind: 'shipped' | 'delivered'
  /** The number the buyer sees on the order they paid for (the parent order). */
  orderDisplayId: string | number
  sellerName?: string | null
  customerName?: string
  items: { title: string; quantity: number }[]
  trackingNumber?: string
  trackingUrl?: string
  preview?: string
}

export const isFulfillmentUpdateTemplateData = (data: any): data is FulfillmentUpdateTemplateProps =>
  (data?.kind === 'shipped' || data?.kind === 'delivered') &&
  (typeof data?.orderDisplayId === 'string' || typeof data?.orderDisplayId === 'number') &&
  Array.isArray(data?.items)

export const FulfillmentUpdateTemplate: React.FC<FulfillmentUpdateTemplateProps> & {
  PreviewProps: FulfillmentUpdateTemplateProps
} = ({ kind, orderDisplayId, sellerName, customerName, items, trackingNumber, trackingUrl, preview }) => {
  const from = sellerName ? ` from ${sellerName}` : ''
  const headline = kind === 'shipped' ? `Your items${from} are on their way` : `Your items${from} were delivered`

  return (
    <Base preview={preview ?? headline}>
      <Section>
        <Text style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 30px' }}>
          {headline}
        </Text>

        <Text style={{ margin: '0 0 20px' }}>
          {customerName ? `Hi ${customerName}, ` : ''}
          {kind === 'shipped'
            ? `part of your order #${orderDisplayId} has been shipped.`
            : `part of your order #${orderDisplayId} has been delivered.`}
        </Text>

        <Hr style={{ margin: '20px 0' }} />

        {items.map((item, index) => (
          <Text key={`${item.title}-${index}`} style={{ margin: '0 0 6px' }}>
            {item.quantity} x {item.title}
          </Text>
        ))}

        {kind === 'shipped' && trackingNumber ? (
          <>
            <Hr style={{ margin: '20px 0' }} />
            <Text style={{ margin: '0 0 6px', fontWeight: 'bold' }}>Tracking number</Text>
            <Text style={{ margin: '0 0 6px' }}>
              {trackingUrl ? <Link href={trackingUrl}>{trackingNumber}</Link> : trackingNumber}
            </Text>
          </>
        ) : null}
      </Section>
    </Base>
  )
}

FulfillmentUpdateTemplate.PreviewProps = {
  kind: 'shipped',
  orderDisplayId: 1001,
  sellerName: 'Acme Store',
  customerName: 'Sam',
  items: [{ title: 'Blue mug', quantity: 2 }],
  trackingNumber: 'TRK123456',
  trackingUrl: 'https://tracking.example.com/TRK123456'
} as FulfillmentUpdateTemplateProps

export default FulfillmentUpdateTemplate
