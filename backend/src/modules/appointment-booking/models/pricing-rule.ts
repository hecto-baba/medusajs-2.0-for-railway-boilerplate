import { model } from "@medusajs/framework/utils"

/**
 * A price adjustment a vendor applies to bookings automatically, by weekday
 * and/or time of day. The server evaluates these when a slot is reserved and
 * sets the cart line's unit price from the result - the client never supplies
 * a price.
 *
 * `value` meaning depends on `type`:
 *   - percent_adjust: a percentage, e.g. 20 = +20%, -15 = 15% off
 *   - fixed_adjust:   an amount in the currency's MAJOR unit added (or, if
 *                     negative, subtracted), e.g. 10 = +$10 (Medusa v2 stores
 *                     prices in major units)
 *   - override_price: the exact price in the currency's major unit
 * fixed_adjust and override_price require currency_code.
 */
export const PricingRule = model.define("pricing_rule", {
  id: model.id().primaryKey(),
  vendor_id: model.text(),
  // Scope. Both null = applies to everything the vendor sells.
  resource_id: model.text().nullable(),
  product_id: model.text().nullable(),
  name: model.text(),
  type: model.enum(["percent_adjust", "fixed_adjust", "override_price"]),
  value: model.float(),
  currency_code: model.text().nullable(),
  // 0-6 (Sunday-Saturday) in the resource's timezone; null = every day.
  days_of_week: model.json().nullable(),
  // "HH:mm" local to the resource's timezone; both null = all day.
  start_time: model.text().nullable(),
  end_time: model.text().nullable(),
  valid_from: model.dateTime().nullable(),
  valid_until: model.dateTime().nullable(),
  // Higher wins. Ties are broken by the more specific scope.
  priority: model.number().default(0),
  is_active: model.boolean().default(true),
})
.indexes([
  {
    on: ["vendor_id", "resource_id"],
  },
])
