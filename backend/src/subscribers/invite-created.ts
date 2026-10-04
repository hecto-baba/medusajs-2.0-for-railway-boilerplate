import { createHash } from 'crypto'
import { IUserModuleService } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { BACKEND_URL } from '../lib/constants'
import { sendEmail } from '../lib/send-email'
import { EmailTemplates } from '../modules/email-notifications/templates'

async function userInviteHandler({
    event: { data },
    container,
  }: SubscriberArgs<any>) {

  const userModuleService: IUserModuleService = container.resolve(Modules.USER)
  const invite = await userModuleService.retrieveInvite(data.id)

  // A resend issues a new token, so the token (hashed) tells the first send from
  // a resend, while a redelivered event for the same token sends nothing twice.
  await sendEmail(container, {
    template: EmailTemplates.INVITE_USER,
    to: invite.email,
    subject: `You've been invited to ${process.env.STORE_NAME || 'your store'}!`,
    idempotencyKey: `invite-user:${invite.id}:${createHash('sha256').update(String(invite.token)).digest('hex').slice(0, 16)}`,
    resourceId: invite.id,
    resourceType: 'invite',
    data: {
      inviteLink: `${BACKEND_URL}/app/invite?token=${invite.token}`,
      preview: 'The administration dashboard awaits...'
    }
  })
}

/**
 * Whatever goes wrong while preparing the email (a record deleted since the
 * event, a failed lookup) must not surface as an unhandled error in the event
 * bus: the order, invite or reply that triggered this has already succeeded.
 */
export default async function userInviteHandlerSafe(args: Parameters<typeof userInviteHandler>[0]) {
  try {
    await userInviteHandler(args)
  } catch (error: any) {
    console.error('Error sending invite email:', error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: ['invite.created', 'invite.resent']
}
