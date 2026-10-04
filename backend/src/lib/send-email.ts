import { Modules } from '@medusajs/framework/utils'
import type { INotificationModuleService, MedusaContainer } from '@medusajs/framework/types'
import { ZEPTOMAIL_FROM_EMAIL } from './constants'

export type SendEmailInput = {
  /** A key from EmailTemplates. */
  template: string
  to: string
  subject: string
  /** Template props. `emailOptions` is added here, so do not pass it. */
  data: Record<string, unknown>
  /**
   * Identifies this one email, e.g. `order-cancelled:order_01H...`. An email with
   * a key that already succeeded (or is being sent) is never sent again, even
   * when the event is delivered twice or two workers race.
   */
  idempotencyKey: string
  /** The thing the email is about, stored on the notification row. */
  resourceId?: string
  resourceType?: string
  replyTo?: string
}

export type SendEmailResult = 'sent' | 'skipped' | 'failed'

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [500, 1500]

/**
 * Every attempt is stored under its own key: `<key>`, `<key>~1`, `<key>~2`...
 *
 * Retrying a FAILED row under the SAME key does not work: Medusa's notification
 * module re-sends it, then updates a record id it never saved and throws, so a
 * delivered email looks like a failure and the next run sends it again. A fresh
 * key per attempt avoids that, and this list is also what bounds the total number
 * of attempts across runs (the quote job re-tries a failed email every minute).
 */
const MAX_KEYS = 8
const keyFor = (base: string, index: number) => (index === 0 ? base : `${base}~${index}`)
const baseOf = (key: string) => key.replace(/~\d+$/, '')

// A send that crashed mid-way leaves a row "pending"; after this it is treated as dead.
const STALE_PENDING_MS = 10 * 60 * 1000

// ZeptoMail rate limits (429), server errors (5xx) and an unreachable host are
// worth retrying. A rejected address or a bad template will not fix itself.
const TRANSIENT = /Failed to reach ZeptoMail|\b(429|5\d\d)\b|ECONNRESET|ETIMEDOUT|fetch failed/i

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Row = { idempotency_key: string; status: string; created_at?: string | Date }

const resolveNotifications = (container: Pick<MedusaContainer, 'resolve'>): INotificationModuleService | null => {
  try {
    return container.resolve(Modules.NOTIFICATION)
  } catch {
    // ZeptoMail is not configured, so the notification module is not registered.
    return null
  }
}

/**
 * The base keys among `filters` that already went out. One query for many
 * emails, so a job can drop what is done before doing any per-email work.
 */
export async function findSentBaseKeys(
  container: Pick<MedusaContainer, 'resolve'>,
  filters: { resource_type: string; resource_ids: string[] }
): Promise<Set<string>> {
  const done = new Set<string>()
  const notifications = resolveNotifications(container)
  if (!notifications || !filters.resource_ids.length) return done

  const rows: any[] = await (notifications as any).listNotifications(
    { resource_type: filters.resource_type, resource_id: filters.resource_ids, status: 'success' },
    { select: ['idempotency_key'], take: null }
  )
  for (const row of rows) {
    if (row.idempotency_key) done.add(baseOf(row.idempotency_key))
  }
  return done
}

/**
 * Sends one transactional email. It NEVER throws: an order, payment or booking
 * must succeed even when its email cannot be sent, so every failure is logged
 * and returned as a result instead.
 *
 *  - 'sent'    the provider accepted it.
 *  - 'skipped' this email already went out (or is being sent right now).
 *  - 'failed'  all attempts failed, or the error was not worth retrying. A later
 *              call (a redelivered event, the next job run) tries again, up to
 *              MAX_KEYS attempts in total.
 */
export async function sendEmail(
  container: Pick<MedusaContainer, 'resolve'>,
  input: SendEmailInput
): Promise<SendEmailResult> {
  const logger: any = container.resolve('logger')

  try {
    if (!input.to) {
      logger.warn(`Not sending "${input.template}" (${input.idempotencyKey}): no recipient address`)
      return 'failed'
    }

    const notifications = resolveNotifications(container)
    if (!notifications) {
      logger.warn(`Not sending "${input.template}" (${input.idempotencyKey}): email is not configured`)
      return 'failed'
    }

    // What has already happened under this key?
    const candidates = Array.from({ length: MAX_KEYS }, (_, i) => keyFor(input.idempotencyKey, i))
    const existing: Row[] = await (notifications as any).listNotifications(
      { idempotency_key: candidates },
      { select: ['idempotency_key', 'status', 'created_at'], take: null }
    )
    const byKey = new Map(existing.map((row) => [row.idempotency_key, row]))

    for (const row of existing) {
      const inFlight =
        row.status === 'pending' && Date.now() - new Date(row.created_at ?? 0).getTime() < STALE_PENDING_MS
      if (row.status === 'success' || inFlight) {
        logger.info(`Skipped "${input.template}" (${input.idempotencyKey}): already sent`)
        return 'skipped'
      }
    }

    // First key not used by an earlier attempt.
    let next = candidates.findIndex((key) => !byKey.has(key))
    if (next === -1) {
      logger.error(
        `email_failed template=${input.template} key=${input.idempotencyKey} to=${input.to}: gave up after ${MAX_KEYS} attempts`
      )
      return 'failed'
    }

    const payload = {
      to: input.to,
      channel: 'email',
      template: input.template,
      resource_id: input.resourceId,
      resource_type: input.resourceType,
      data: {
        ...input.data,
        emailOptions: {
          replyTo: input.replyTo || process.env.ORDER_REPLY_TO_EMAIL || ZEPTOMAIL_FROM_EMAIL,
          subject: input.subject,
        },
      },
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && next < MAX_KEYS; attempt++, next++) {
      try {
        await notifications.createNotifications({ ...payload, idempotency_key: keyFor(input.idempotencyKey, next) } as any)
        return 'sent'
      } catch (error: any) {
        const message: string = error?.message ?? String(error)

        // Two workers racing for one key: the loser hits the unique index. The
        // winner is sending it, so this is a duplicate, not a failure.
        if (/idempotency_key|duplicate key|unique constraint/i.test(message)) {
          logger.info(`Skipped "${input.template}" (${input.idempotencyKey}): already being sent`)
          return 'skipped'
        }

        if (TRANSIENT.test(message) && attempt < MAX_ATTEMPTS && next + 1 < MAX_KEYS) {
          logger.warn(
            `"${input.template}" (${input.idempotencyKey}) attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying: ${message}`
          )
          await sleep(BACKOFF_MS[attempt - 1] ?? 1500)
          continue
        }

        logger.error(
          `email_failed template=${input.template} key=${input.idempotencyKey} to=${input.to} attempts=${attempt}: ${message}`
        )
        return 'failed'
      }
    }

    return 'failed'
  } catch (error: any) {
    // The lookup itself failed (database down). Still must not surface to the caller.
    logger.error(
      `email_failed template=${input.template} key=${input.idempotencyKey}: ${error?.message ?? error}`
    )
    return 'failed'
  }
}
