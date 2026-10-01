import { Text, Section, Hr } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ENQUIRY_RESPONDED = 'enquiry-responded'

interface EnquiryRespondedPreviewProps {
  productTitle: string
  message: string
  reply: string
  storeName?: string
}

export interface EnquiryRespondedTemplateProps {
  productTitle: string
  message: string
  reply: string
  /** No pricing or order data belongs on this template - see
   * docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN.md, Decisions table
   * ("Reply visibility": private, 1:1, not a public product Q&A). */
  storeName?: string
  preview?: string
}

export const isEnquiryRespondedTemplateData = (data: any): data is EnquiryRespondedTemplateProps =>
  typeof data?.productTitle === 'string' &&
  typeof data?.message === 'string' &&
  typeof data?.reply === 'string'

export const EnquiryRespondedTemplate: React.FC<EnquiryRespondedTemplateProps> & {
  PreviewProps: EnquiryRespondedPreviewProps
} = ({ productTitle, message, reply, storeName, preview = 'You have a reply to your product question' }) => {
  return (
    <Base preview={preview}>
      <Section>
        <Text style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 30px' }}>
          You have a reply to your question
        </Text>

        <Text style={{ margin: '0 0 20px' }}>
          {storeName ? `${storeName} replied` : 'We replied'} to your question about{' '}
          <strong>{productTitle}</strong>:
        </Text>

        <Text style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px', color: '#666' }}>
          Your question
        </Text>
        <Text style={{ margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>
          {message}
        </Text>

        <Hr style={{ margin: '20px 0' }} />

        <Text style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px', color: '#666' }}>
          {storeName ? `${storeName}'s reply` : 'Reply'}
        </Text>
        <Text style={{ margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>
          {reply}
        </Text>
      </Section>
    </Base>
  )
}

EnquiryRespondedTemplate.PreviewProps = {
  productTitle: 'Test Product',
  message: 'Is this available in blue, and does it ship internationally?',
  reply: "Yes, it's available in blue and we do ship internationally.",
  storeName: 'Acme Store'
} as EnquiryRespondedPreviewProps

export default EnquiryRespondedTemplate
