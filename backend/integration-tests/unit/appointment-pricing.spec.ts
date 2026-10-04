import {
  PricingContext,
  PricingRuleLike,
  applyPricingRules,
  validatePricingRule,
} from "../../src/modules/appointment-booking/lib/pricing"

// Saturday 2030-01-12 18:00 in New York = 23:00Z.
const ctx = (over: Partial<PricingContext> = {}): PricingContext => ({
  resource_id: "res_1",
  product_id: "prod_1",
  start: new Date("2030-01-12T23:00:00.000Z"),
  timezone: "America/New_York",
  currency_code: "usd",
  ...over,
})

const rule = (over: Partial<PricingRuleLike> = {}): PricingRuleLike => ({
  id: "rule_a",
  type: "percent_adjust",
  value: 20,
  priority: 0,
  is_active: true,
  ...over,
})

describe("applyPricingRules", () => {
  it("returns the base price when no rule matches", () => {
    expect(applyPricingRules(40, [], ctx())).toEqual({
      base_price: 40,
      price: 40,
      applied_rule_id: null,
    })
  })

  it("applies a weekend percentage surcharge in the resource's local weekday", () => {
    const r = rule({ days_of_week: [6] }) // Saturday only
    expect(applyPricingRules(40, [r], ctx()).price).toBe(48)
    // The same instant is Sunday 2030-01-13 in Auckland (UTC+13): rule must not apply.
    expect(
      applyPricingRules(40, [r], ctx({ timezone: "Pacific/Auckland" })).applied_rule_id
    ).toBeNull()
  })

  it("matches time bands as [start, end)", () => {
    const r = rule({ type: "fixed_adjust", value: 10, currency_code: "usd", start_time: "17:00", end_time: "20:00" })
    expect(applyPricingRules(40, [r], ctx()).price).toBe(50) // 18:00 local
    expect(
      applyPricingRules(40, [r], ctx({ start: new Date("2030-01-13T01:00:00.000Z") })).applied_rule_id
    ).toBeNull() // 20:00 local is outside
  })

  it("only applies money rules in their own currency", () => {
    const r = rule({ type: "fixed_adjust", value: 10, currency_code: "eur" })
    expect(applyPricingRules(40, [r], ctx()).applied_rule_id).toBeNull()
    expect(applyPricingRules(40, [r], ctx({ currency_code: "EUR" })).price).toBe(50)
  })

  it("supports an exact price override", () => {
    const r = rule({ type: "override_price", value: 25, currency_code: "usd" })
    expect(applyPricingRules(40, [r], ctx()).price).toBe(25)
  })

  it("never goes below zero", () => {
    const r = rule({ type: "fixed_adjust", value: -100, currency_code: "usd" })
    expect(applyPricingRules(40, [r], ctx()).price).toBe(0)
  })

  it("picks the highest priority, then the most specific scope", () => {
    const low = rule({ id: "low", value: 10, priority: 1 })
    const high = rule({ id: "high", value: 50, priority: 5 })
    expect(applyPricingRules(100, [low, high], ctx()).applied_rule_id).toBe("high")

    const vendorWide = rule({ id: "wide", value: 10, priority: 1 })
    const resourceSpecific = rule({ id: "specific", value: 30, priority: 1, resource_id: "res_1" })
    expect(applyPricingRules(100, [vendorWide, resourceSpecific], ctx()).applied_rule_id).toBe("specific")
  })

  it("ignores rules scoped to another resource/product, inactive rules and expired rules", () => {
    expect(applyPricingRules(40, [rule({ resource_id: "other" })], ctx()).applied_rule_id).toBeNull()
    expect(applyPricingRules(40, [rule({ product_id: "other" })], ctx()).applied_rule_id).toBeNull()
    expect(applyPricingRules(40, [rule({ is_active: false })], ctx()).applied_rule_id).toBeNull()
    expect(
      applyPricingRules(40, [rule({ valid_until: "2030-01-01T00:00:00.000Z" })], ctx()).applied_rule_id
    ).toBeNull()
  })

  it("rounds to the currency precision", () => {
    expect(applyPricingRules(33.33, [rule({ value: 10 })], ctx()).price).toBe(36.66)
    expect(applyPricingRules(1000, [rule({ value: 12.5 })], ctx({ currency_code: "jpy" }), 0).price).toBe(1125)
  })
})

describe("validatePricingRule", () => {
  it("accepts a valid rule", () => {
    expect(validatePricingRule({ type: "percent_adjust", value: 20, days_of_week: [0, 6] })).toBeNull()
  })

  it("rejects bad input", () => {
    expect(validatePricingRule({ type: "percent_adjust", value: -100 })).toMatch(/percentage/)
    expect(validatePricingRule({ type: "fixed_adjust", value: 5 })).toMatch(/currency_code/)
    expect(validatePricingRule({ type: "override_price", value: -1, currency_code: "usd" })).toMatch(/negative/)
    expect(validatePricingRule({ type: "percent_adjust", value: 5, days_of_week: [7] })).toMatch(/days_of_week/)
    expect(validatePricingRule({ type: "percent_adjust", value: 5, start_time: "09:00" })).toMatch(/together/)
    expect(
      validatePricingRule({ type: "percent_adjust", value: 5, start_time: "10:00", end_time: "09:00" })
    ).toMatch(/before/)
  })
})
