import { createHmac, timingSafeEqual } from "crypto"

/**
 * A signed token that lets a GUEST buyer (no account) cancel their own booking
 * from the link in their confirmation email. It is an HMAC of the attendee id,
 * so it cannot be forged or reused for another booking, and it needs no storage.
 *
 * Signed with the server's JWT/cookie secret. It authorises exactly one action -
 * cancelling that one booking, which is itself still bound by the resource's
 * cancellation window - so a leaked link can do no more than the guest could.
 */
const secret = (): string => {
  const value = process.env.JWT_SECRET || process.env.COOKIE_SECRET
  if (!value) {
    throw new Error("JWT_SECRET or COOKIE_SECRET must be set to sign cancellation links")
  }
  return value
}

export const signCancelToken = (attendeeId: string): string =>
  createHmac("sha256", secret()).update(`appointment-cancel:${attendeeId}`).digest("hex")

export const verifyCancelToken = (attendeeId: string, token: string | undefined): boolean => {
  if (!token || typeof token !== "string") return false
  const expected = Buffer.from(signCancelToken(attendeeId), "hex")
  let provided: Buffer
  try {
    provided = Buffer.from(token, "hex")
  } catch {
    return false
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}
