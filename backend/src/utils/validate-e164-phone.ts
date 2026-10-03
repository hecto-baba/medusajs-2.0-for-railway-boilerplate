/**
 * E.164 format check: a leading "+", no leading zero after it, then 1-14
 * more digits (2-15 digits total, per the spec) - e.g. "+14155552671".
 * Format-only - does not verify the number is actually assigned/reachable.
 *
 * No runtime dependency: sufficient for rejecting obviously malformed input
 * (missing "+", spaces, dashes) at the API boundary. A country-aware input
 * that helps a user *produce* a correct E.164 value belongs on the
 * storefront form (e.g. libphonenumber-js), not here - this is only the
 * backend's reject-bad-input gate. See docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md,
 * Phase B.
 */
const E164_PATTERN = /^\+[1-9]\d{1,14}$/

export const isValidE164 = (value: string): boolean => E164_PATTERN.test(value)

export default isValidE164
