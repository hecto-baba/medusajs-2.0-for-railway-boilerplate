import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { sendRecentQuoteEmails } from "../lib/quote-emails"

/**
 * Sends the emails a quote's state calls for (request, price sent, accepted,
 * declined, paid, dispatched, delivered).
 *
 * Quotes change in many places, so this reads the state instead of listening
 * for each change. Every email has an idempotency key, so re-reading a quote
 * sends nothing twice, and one whose send failed is retried on the next run for
 * as long as the quote stays inside the 30-minute window. See lib/quote-emails.ts.
 */
export default async function sendQuoteEmails(container: MedusaContainer) {
  try {
    container.resolve(Modules.NOTIFICATION)
  } catch {
    // Email is not configured; nothing to send, and nothing worth logging every minute.
    return
  }

  try {
    const sent = await sendRecentQuoteEmails(container)
    if (sent) {
      container.resolve("logger").info(`Sent ${sent} quote email(s)`)
    }
  } catch (error: any) {
    container.resolve("logger").error(`send-quote-emails failed: ${error?.message ?? error}`)
  }
}

export const config = {
  name: "send-quote-emails",
  schedule: "* * * * *",
}
