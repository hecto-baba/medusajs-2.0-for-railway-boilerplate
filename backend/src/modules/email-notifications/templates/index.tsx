import { ReactNode } from 'react'
import { MedusaError } from '@medusajs/framework/utils'
import { InviteUserEmail, INVITE_USER, isInviteUserData } from './invite-user'
import { OrderPlacedTemplate, ORDER_PLACED, isOrderPlacedTemplateData } from './order-placed'
import { ResetPasswordEmail, RESET_PASSWORD, isResetPasswordData } from './reset-password'
import { TicketOrderPlacedTemplate, TICKET_ORDER_PLACED, isTicketOrderPlacedData } from './ticket-order-placed'
import { FulfillmentUpdateTemplate, FULFILLMENT_UPDATE, isFulfillmentUpdateTemplateData } from './fulfillment-update'
import { EnquiryRespondedTemplate, ENQUIRY_RESPONDED, isEnquiryRespondedTemplateData } from './enquiry-responded'

export const EmailTemplates = {
  INVITE_USER,
  ORDER_PLACED,
  RESET_PASSWORD,
  TICKET_ORDER_PLACED,
  ENQUIRY_RESPONDED,
  FULFILLMENT_UPDATE
} as const

export type EmailTemplateType = keyof typeof EmailTemplates

export function generateEmailTemplate(templateKey: string, data: unknown): ReactNode {
  switch (templateKey) {
    case EmailTemplates.INVITE_USER:
      if (!isInviteUserData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.INVITE_USER}"`
        )
      }
      return <InviteUserEmail {...data} />

    case EmailTemplates.ORDER_PLACED:
      if (!isOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ORDER_PLACED}"`
        )
      }
      return <OrderPlacedTemplate {...data} />

    case EmailTemplates.RESET_PASSWORD:
      if (!isResetPasswordData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.RESET_PASSWORD}"`
        )
      }
      return <ResetPasswordEmail {...data} />

    case EmailTemplates.TICKET_ORDER_PLACED:
      if (!isTicketOrderPlacedData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.TICKET_ORDER_PLACED}"`
        )
      }
      return <TicketOrderPlacedTemplate {...data} />

    case EmailTemplates.ENQUIRY_RESPONDED:
      if (!isEnquiryRespondedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ENQUIRY_RESPONDED}"`
        )
      }
      return <EnquiryRespondedTemplate {...data} />

    case EmailTemplates.FULFILLMENT_UPDATE:
      if (!isFulfillmentUpdateTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.FULFILLMENT_UPDATE}"`
        )
      }
      return <FulfillmentUpdateTemplate {...data} />

    default:
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown template key: "${templateKey}"`
      )
  }
}

export { InviteUserEmail, OrderPlacedTemplate, ResetPasswordEmail, TicketOrderPlacedTemplate, EnquiryRespondedTemplate, FulfillmentUpdateTemplate }
