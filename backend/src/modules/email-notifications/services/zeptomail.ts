import { Logger, NotificationTypes } from '@medusajs/framework/types'
import { AbstractNotificationProviderService, MedusaError } from '@medusajs/framework/utils'
import { render } from '@react-email/components'
import { generateEmailTemplate } from '../templates'

type InjectedDependencies = {
  logger: Logger
}

export interface ZeptoMailNotificationServiceOptions {
  api_key: string
  from: string
  from_name?: string
  api_url?: string
}

type NotificationEmailOptions = {
  subject?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  text?: string
}

const DEFAULT_API_URL = 'https://api.zeptomail.com/v1.1/email'

const toList = (value?: string | string[]) =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .map((address) => address.trim())
    .filter(Boolean)
    .map((address) => ({ email_address: { address } }))

/**
 * Sends the store's transactional email through the ZeptoMail API.
 *
 * Templates are react-email components; they are rendered to HTML here because
 * ZeptoMail takes a finished message, not a component.
 */
export class ZeptoMailNotificationService extends AbstractNotificationProviderService {
  static identifier = 'ZEPTOMAIL_NOTIFICATION_SERVICE'
  protected options_: ZeptoMailNotificationServiceOptions
  protected logger_: Logger

  constructor({ logger }: InjectedDependencies, options: ZeptoMailNotificationServiceOptions) {
    super()
    this.options_ = options
    this.logger_ = logger
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    if (!notification) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `No notification information provided`)
    }
    if (notification.channel === 'sms') {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `SMS notification not supported`)
    }

    let html: string
    try {
      html = await render(generateEmailTemplate(notification.template, notification.data) as any)
    } catch (error) {
      if (error instanceof MedusaError) {
        throw error
      }
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to generate email content for template: ${notification.template}`
      )
    }

    const emailOptions = (notification.data.emailOptions ?? {}) as NotificationEmailOptions
    const cc = toList(emailOptions.cc)
    const bcc = toList(emailOptions.bcc)
    const replyTo = emailOptions.replyTo?.trim()

    const body = {
      from: {
        address: notification.from?.trim() || this.options_.from,
        name: this.options_.from_name,
      },
      to: [{ email_address: { address: notification.to } }],
      subject: emailOptions.subject ?? 'You have a new notification',
      htmlbody: html,
      ...(emailOptions.text ? { textbody: emailOptions.text } : {}),
      ...(replyTo ? { reply_to: [{ address: replyTo }] } : {}),
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      ...(Array.isArray(notification.attachments) && notification.attachments.length
        ? {
            attachments: notification.attachments.map((attachment) => ({
              content: attachment.content,
              mime_type: attachment.content_type,
              name: attachment.filename,
            })),
          }
        : {}),
    }

    let response: Response
    try {
      response = await fetch(this.options_.api_url || DEFAULT_API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Zoho-enczapikey ${this.options_.api_key}`,
        },
        body: JSON.stringify(body),
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to reach ZeptoMail to send "${notification.template}" to ${notification.to}: ${detail}`
      )
    }

    const payload: any = await response.json().catch(() => null)

    // ZeptoMail answers 201 on success; anything else carries an error object.
    if (!response.ok) {
      const reason = payload?.error?.message ?? payload?.message ?? response.statusText
      const detail = payload?.error?.details?.[0]?.message
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `ZeptoMail rejected the "${notification.template}" email to ${notification.to}: ${response.status} ${reason}${detail ? ` (${detail})` : ''}`
      )
    }

    this.logger_.log(
      `Successfully sent "${notification.template}" email to ${notification.to} via ZeptoMail`
    )
    return { id: payload?.request_id }
  }
}
