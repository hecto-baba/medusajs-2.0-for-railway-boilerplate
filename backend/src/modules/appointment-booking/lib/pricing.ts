import { hhmmToMinutes, isValidHHmm, localDayAndMinutesAt } from "./timezone"

/**
 * Pricing rules: pure evaluation, no I/O. The server runs this when a slot is
 * reserved and sets the cart line's unit price from the result, so a client can
 * never choose its own price.
 *
 * One rule wins per booking: highest `priority`, ties broken by the more
 * specific scope (resource + product > resource > product > vendor-wide), then
 * by id so the result is deterministic.
 */

export type PricingRuleLike = {
  id: string
  resource_id?: string | null
  product_id?: string | null
  type: "percent_adjust" | "fixed_adjust" | "override_price"
  /** percent_adjust: percent (20 = +20%). Others: amount in the currency's major unit. */
  value: number
  currency_code?: string | null
  days_of_week?: number[] | null
  start_time?: string | null
  end_time?: string | null
  valid_from?: Date | string | null
  valid_until?: Date | string | null
  priority: number
  is_active: boolean
}

export type PricingContext = {
  resource_id: string
  product_id: string
  /** Slot start (UTC instant). */
  start: Date
  /** The resource's IANA timezone: weekdays and time bands are local to it. */
  timezone: string
  currency_code: string
}

export type PriceResult = {
  base_price: number
  price: number
  applied_rule_id: string | null
}

const specificity = (rule: PricingRuleLike): number =>
  (rule.resource_id ? 2 : 0) + (rule.product_id ? 1 : 0)

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export const ruleMatches = (rule: PricingRuleLike, ctx: PricingContext): boolean => {
  if (!rule.is_active) return false
  if (rule.resource_id && rule.resource_id !== ctx.resource_id) return false
  if (rule.product_id && rule.product_id !== ctx.product_id) return false

  // Money rules only apply in the currency they were written for.
  if (rule.type !== "percent_adjust") {
    if (!rule.currency_code) return false
    if (rule.currency_code.toLowerCase() !== ctx.currency_code.toLowerCase()) return false
  }

  const startMs = ctx.start.getTime()
  if (rule.valid_from && new Date(rule.valid_from).getTime() > startMs) return false
  if (rule.valid_until && new Date(rule.valid_until).getTime() < startMs) return false

  const local = localDayAndMinutesAt(startMs, ctx.timezone)

  if (rule.days_of_week && rule.days_of_week.length > 0) {
    if (!rule.days_of_week.includes(local.dayOfWeek)) return false
  }

  const hasBand = !!rule.start_time || !!rule.end_time
  if (hasBand) {
    if (!isValidHHmm(rule.start_time) || !isValidHHmm(rule.end_time)) return false
    // [start, end): a band 17:00-20:00 covers a 17:00 slot but not a 20:00 one.
    if (local.minutes < hhmmToMinutes(rule.start_time)) return false
    if (local.minutes >= hhmmToMinutes(rule.end_time)) return false
  }

  return true
}

export const pickWinningRule = (
  rules: PricingRuleLike[],
  ctx: PricingContext
): PricingRuleLike | null => {
  const matching = rules.filter((r) => ruleMatches(r, ctx))
  if (!matching.length) return null
  matching.sort(
    (a, b) =>
      b.priority - a.priority ||
      specificity(b) - specificity(a) ||
      a.id.localeCompare(b.id)
  )
  return matching[0]
}

/**
 * @param basePrice the variant's calculated price in the cart's currency
 * @param decimals  currency precision (2 for most, 0 for e.g. JPY)
 */
export const applyPricingRules = (
  basePrice: number,
  rules: PricingRuleLike[],
  ctx: PricingContext,
  decimals = 2
): PriceResult => {
  const winner = pickWinningRule(rules, ctx)

  if (!winner) {
    return { base_price: basePrice, price: roundTo(basePrice, decimals), applied_rule_id: null }
  }

  let price = basePrice
  if (winner.type === "percent_adjust") price = basePrice * (1 + winner.value / 100)
  else if (winner.type === "fixed_adjust") price = basePrice + winner.value
  else price = winner.value

  return {
    base_price: basePrice,
    price: Math.max(0, roundTo(price, decimals)),
    applied_rule_id: winner.id,
  }
}

/** Validation shared by the create/update pricing-rule routes. */
export const validatePricingRule = (rule: {
  type: PricingRuleLike["type"]
  value: number
  currency_code?: string | null
  days_of_week?: number[] | null
  start_time?: string | null
  end_time?: string | null
  valid_from?: Date | string | null
  valid_until?: Date | string | null
}): string | null => {
  if (!Number.isFinite(rule.value)) return "value must be a number"
  if (rule.type === "percent_adjust" && (rule.value <= -100 || rule.value > 1000)) {
    return "A percentage must be greater than -100 and at most 1000"
  }
  if (rule.type === "override_price" && rule.value < 0) {
    return "An exact price cannot be negative"
  }
  if (rule.type !== "percent_adjust" && !rule.currency_code) {
    return "currency_code is required for fixed and exact-price rules"
  }
  if (rule.days_of_week) {
    if (rule.days_of_week.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      return "days_of_week values must be integers from 0 (Sunday) to 6 (Saturday)"
    }
  }
  const hasStart = !!rule.start_time
  const hasEnd = !!rule.end_time
  if (hasStart !== hasEnd) return "start_time and end_time must be provided together"
  if (hasStart && hasEnd) {
    if (!isValidHHmm(rule.start_time) || !isValidHHmm(rule.end_time)) {
      return "start_time and end_time must be in HH:mm format"
    }
    if (hhmmToMinutes(rule.start_time) >= hhmmToMinutes(rule.end_time)) {
      return "start_time must be before end_time"
    }
  }
  if (
    rule.valid_from &&
    rule.valid_until &&
    new Date(rule.valid_until).getTime() < new Date(rule.valid_from).getTime()
  ) {
    return "valid_until must not be before valid_from"
  }
  return null
}
