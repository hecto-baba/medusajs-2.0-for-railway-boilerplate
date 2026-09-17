# Rental Module Extension — Admin / Backend Plan

Scope: everything inside `medusajs-2.0-for-railway-boilerplate/backend/`. Covers the data model, workflows, API routes, and the admin "Rental Configuration" widget. The companion document `RENTAL_MODULE_PLAN_STOREFRONT.md` covers the customer-facing side.

## Goal

Extend the existing day-only rental module (`min_rental_days` / `max_rental_days`, no deposit, no unit concept) to support:
- Rental units: **hour, day, week, month, custom** (plain day count)
- A **security deposit** per product (fixed amount or % of rental total)
- Pickup / return **time-of-day** on every unit
- All changes additive — no existing column dropped or renamed, no existing rental/order broken

## Current state (confirmed in codebase)

| Piece | File |
|---|---|
| Module registration | `backend/medusa-config.js` → `{ resolve: './src/modules/rental' }` |
| `RentalConfiguration` model | `backend/src/modules/rental/models/rental-configuration.ts` — `product_id, min_rental_days, max_rental_days, status` |
| `Rental` model (booking record) | `backend/src/modules/rental/models/rental.ts` — `variant_id, customer_id, order_id, line_item_id, rental_start_date, rental_end_date, actual_return_date, rental_days, status, rental_configuration_id` |
| Existing migration | `backend/src/modules/rental/migrations/Migration20260910185745.ts` |
| Service | `backend/src/modules/rental/service.ts` — `hasRentalOverlap()` + auto-generated CRUD |
| Product↔config link | `backend/src/links/product-rental-config.ts` |
| Other links | `backend/src/links/rental-variant.ts`, `rental-order.ts`, `rental-line-item.ts`, `customer-rental.ts` |
| "Make Rentable" workflow | `backend/src/workflows/upsert-rental-config.ts` |
| Add-to-cart workflow | `backend/src/workflows/add-to-cart-with-rental.ts` |
| Checkout-completion workflow | `backend/src/workflows/create-rentals.ts` |
| Rental status update workflow | `backend/src/workflows/update-rental.ts` |
| Steps | `backend/src/workflows/steps/{create-rental-configuration,update-rental-configuration,validate-rental-cart-item,validate-rental,create-rentals-for-order,update-rental,calculate-rental-price(dead)}.ts` |
| Hooks | `backend/src/workflows/hooks/{validate-rental,validate-order-cancel}.ts` |
| Admin widgets | `backend/src/admin/widgets/product-rental-config.tsx`, `order-rental-items.tsx` |
| Admin API routes | `backend/src/api/admin/products/[id]/rental-config/route.ts`, `backend/src/api/admin/orders/[id]/rentals/route.ts`, `backend/src/api/admin/rentals/[id]/route.ts` |
| Store API routes | `backend/src/api/store/products/[id]/rental-availability/route.ts`, `backend/src/api/store/carts/[id]/line-items/rentals/route.ts`, `backend/src/api/store/rentals/[cart_id]/route.ts` |
| Vendor API routes | `backend/src/api/vendors/products/[id]/rental-config/route.ts` |
| Duration/validation utils | `backend/src/utils/count-rental-days.ts`, `backend/src/utils/validate-rental-dates.ts`, `backend/src/utils/has-cart-overlap.ts` |
| Cron / subscribers | `backend/src/jobs/activate-rentals.ts`, `backend/src/subscribers/shipment-created.ts`, `backend/src/subscribers/order-canceled.ts` |
| Middleware validation wiring | `backend/src/api/middlewares.ts` |

Pricing today: `variant.calculated_price.calculated_amount × rental_days`, duplicated in 2 live places + 1 dead step. No deposit field exists anywhere. No unit concept exists anywhere (confirmed via full-repo grep).

---

## Phase 0 — Safety prep

- [ ] Confirm the target database is dev/staging, not a production DB with real customer data
- [ ] Take a full DB backup / export (or confirm Railway/managed DB has point-in-time recovery)
- [ ] Confirm working tree is clean (`git status`) before starting; this repo currently reports **not a git repository** at the top level — confirm whether `medusajs-2.0-for-railway-boilerplate/` itself is a git repo (`.git` folder exists there) and commit any in-progress work first
- [ ] Create a feature branch, e.g. `feature/rental-units-and-deposit`

---

## Phase 1 — Data model changes

### 1.1 Extend `RentalConfiguration` model
File: `backend/src/modules/rental/models/rental-configuration.ts`

- [ ] Add `rental_unit: model.enum(["hour", "day", "week", "month", "custom"]).default("day")`
- [ ] Add `min_rental_units: model.number().default(1)` (generic replacement for `min_rental_days`)
- [ ] Add `max_rental_units: model.number().nullable()` (generic replacement for `max_rental_days`)
- [ ] **Keep `min_rental_days` / `max_rental_days` columns in place** — do not delete/rename. New code reads/writes the new `*_units` columns; a migration step (1.3) backfills them from the old columns so nothing existing breaks.
- [ ] Add `security_deposit_amount: model.bigNumber().default(0)` (use Medusa's money/BigNumber field type to stay consistent with how prices are stored elsewhere — confirm exact helper by checking how other modules in this repo store money, e.g. `transaction-type` or core Order models)
- [ ] Add `security_deposit_type: model.enum(["fixed", "percentage"]).default("fixed")`
- [ ] Add `requires_time_selection: model.boolean().default(false)` — lets admin decide whether pickup/return time-of-day is asked on the storefront for this product (some rental businesses don't need it even for day/week/month)

### 1.2 Extend `Rental` model
File: `backend/src/modules/rental/models/rental.ts`

- [ ] Add `rental_unit: model.enum(["hour", "day", "week", "month", "custom"])` — snapshot of the unit at booking time (config can change later; the booking record shouldn't)
- [ ] Add `rental_units_count: model.number()` — the quantity in that unit (e.g. `2` weeks), generic replacement for relying solely on `rental_days`
- [ ] Add `pickup_time: model.text().nullable()` — store as `"HH:mm"` 24h string, kept simple rather than a second datetime type
- [ ] Add `return_time: model.text().nullable()`
- [ ] Add `security_deposit_amount: model.bigNumber().default(0)` — snapshot of the deposit charged for this specific booking
- [ ] Add `security_deposit_status: model.enum(["held", "refunded", "partially_refunded", "forfeited"]).nullable()`
- [ ] Keep `rental_days` as-is (still populated, still the source of truth for existing day-based overlap logic)

### 1.3 Migration
File: new `backend/src/modules/rental/migrations/Migration<timestamp>_rental_units_and_deposit.ts`

- [ ] Run `npx medusa db:generate rental` (or the project's equivalent migration-generation command — confirm exact script in `backend/package.json`) to scaffold the migration from the model diff, rather than hand-writing SQL
- [ ] Add an explicit backfill statement in the migration (or a follow-up data migration) so every existing `rental_configuration` row gets `rental_unit = 'day'`, `min_rental_units = min_rental_days`, `max_rental_units = max_rental_days` — this is the step that guarantees zero behavior change for existing rentable products
- [ ] Review generated SQL by hand before applying — confirm defaults match Phase 1.1/1.2, confirm no column is dropped
- [ ] Run migration against **local/dev DB only** first: `npx medusa db:migrate`
- [ ] Verify with a direct query that existing rows now have `rental_unit = 'day'` and correct backfilled `*_units` values

---

## Phase 2 — Centralize pricing & duration logic

This must happen before wiring units through workflows, since duration math needs a single implementation that understands all 5 units.

- [ ] Create `backend/src/utils/rental-pricing.ts` exporting one function, e.g. `calculateRentalTotal({ unitRate, unitsCount, unit, depositAmount, depositType }) => { subtotal, depositAmount, total }`
- [ ] Create/extend `backend/src/utils/count-rental-units.ts` — given `(start: Date, end: Date, unit: RentalUnit)`, returns the units count consistent with how the storefront will compute it (see storefront plan: day = inclusive day count, week = `span_days / 7` rolling, month = `span_days / 30` rolling, custom = plain day count, hour = handled separately via time slots on a single day)
- [ ] Replace the 3 duplicated `calculated_amount * days` call sites with the new shared function:
  - `backend/src/workflows/steps/validate-rental-cart-item.ts`
  - `backend/src/api/store/products/[id]/rental-availability/route.ts`
  - Delete the dead `backend/src/workflows/steps/calculate-rental-price.ts`, OR repurpose it to be the one canonical step other workflows call — pick repurpose if you want a workflow-step-level abstraction, delete if the plain util function is enough (recommended: repurpose, since steps get automatic compensation/logging)
- [ ] Update `backend/src/utils/validate-rental-dates.ts` to validate against `min_rental_units`/`max_rental_units` + `rental_unit`, not hardcoded days (keep a day-based fallback path for `rental_unit === "day"` so behavior is provably unchanged for existing configs)

---

## Phase 3 — Workflows

### 3.1 `upsertRentalConfigWorkflow`
File: `backend/src/workflows/upsert-rental-config.ts` + steps `create-rental-configuration.ts` / `update-rental-configuration.ts`

- [ ] Extend workflow input type to accept `rental_unit`, `min_rental_units`, `max_rental_units`, `security_deposit_amount`, `security_deposit_type`, `requires_time_selection`
- [ ] Keep accepting the old `min_rental_days`/`max_rental_days` input shape too (backward-compatible) — if only old fields are passed, set `rental_unit: "day"` and mirror values into the new `*_units` fields, so any existing caller (including cached admin UI, if not redeployed simultaneously) keeps working
- [ ] Update both steps' compensation/rollback logic to cover the new fields

### 3.2 `addToCartWithRentalWorkflow`
File: `backend/src/workflows/add-to-cart-with-rental.ts` + `backend/src/workflows/steps/validate-rental-cart-item.ts`

- [ ] Accept `rental_units_count`, `rental_unit`, `pickup_time`, `return_time` in the workflow input (alongside existing `rental_start_date`/`rental_end_date`)
- [ ] Use the Phase 2 shared pricing function to compute `unit_price` (rental subtotal) — keep deposit **out** of `unit_price`; see 3.4 for how deposit is added
- [ ] Store `rental_unit`, `rental_units_count`, `pickup_time`, `return_time` on the cart line item's `metadata` (matches existing pattern — `rental_start_date`/`rental_end_date`/`rental_days` are already stored there per the storefront's `line-item-rental-dates` component reading `item.metadata`)

### 3.3 `createRentalsWorkflow`
File: `backend/src/workflows/create-rentals.ts` + `backend/src/workflows/steps/create-rentals-for-order.ts`

- [ ] Persist the new `Rental` fields (`rental_unit`, `rental_units_count`, `pickup_time`, `return_time`, `security_deposit_amount`, `security_deposit_status: "held"`) when creating the `Rental` row from cart metadata

### 3.4 Deposit as a separate cart line item (Phase 1 approach — no payment-provider changes)
New file: `backend/src/workflows/steps/add-deposit-line-item.ts`, wired into `add-to-cart-with-rental.ts`

- [ ] When a rental item is added and its config has `security_deposit_amount > 0`, add a **second** cart line item representing the deposit (a synthetic/custom line item, or a dedicated "Security Deposit" product+variant seeded once — confirm which approach fits this store's existing custom-line-item patterns, e.g. check how `ticket-booking` or `transaction-type` modules add non-catalog line items, if they do)
- [ ] Tag the deposit line item's metadata with `is_rental_deposit: true` and the `rental` line item id it belongs to, so it can be identified/removed together (e.g. if the shopper removes the rental item, remove its deposit line item too — add this as a cart-update hook or handle in the same workflow)
- [ ] Do **not** attempt payment authorization holds in this phase — deposit is charged like a normal cart item at checkout, refunded manually by the admin (Phase 5 admin UI exposes a manual refund/forfeit action)

### 3.5 `updateRentalWorkflow`
File: `backend/src/workflows/update-rental.ts` + `backend/src/workflows/steps/update-rental.ts`

- [ ] Add a way to transition `security_deposit_status` (`held → refunded / partially_refunded / forfeited`) — either extend this workflow's input or add a small sibling workflow `updateRentalDepositWorkflow`
- [ ] No payment-provider interaction in this phase — purely a status/record update the admin makes after inspecting the returned item

---

## Phase 4 — API routes

### 4.1 Admin config route
File: `backend/src/api/admin/products/[id]/rental-config/route.ts`

- [ ] Extend `PostRentalConfigBodySchema` (zod) to include `rental_unit`, `min_rental_units`, `max_rental_units`, `security_deposit_amount`, `security_deposit_type`, `requires_time_selection` — all optional, matching the workflow's backward-compatible input
- [ ] GET response already returns `rental_config: rentalConfigs[0]` via `query.graph({ entity: "rental_configuration", fields: ["*"] })` — no change needed since `fields: ["*"]` will automatically include new columns once the migration runs

### 4.2 Vendor config route (mirror of 4.1)
File: `backend/src/api/vendors/products/[id]/rental-config/route.ts`

- [ ] Same schema extension, same `assertOwnership` guard already in place — just widen the zod schema

### 4.3 Store availability route
File: `backend/src/api/store/products/[id]/rental-availability/route.ts`

- [ ] Accept `rental_unit`, `rental_units_count` (or keep accepting `start_date`/`end_date` and derive units count server-side using Phase 2's shared util — recommended, since it keeps the server as the single source of truth for pricing/validation exactly as it is today)
- [ ] Response should include a `deposit` object (`{ amount, type }`) alongside the existing `price` object, so the storefront can render the deposit line without a second request

### 4.4 Deposit status route (new, admin-only)
New file: `backend/src/api/admin/rentals/[id]/deposit/route.ts`

- [ ] `POST` body `{ status: "refunded" | "partially_refunded" | "forfeited", refund_amount?, note? }`
- [ ] Runs the `updateRentalDepositWorkflow` from 3.5

### 4.5 Middleware wiring
File: `backend/src/api/middlewares.ts`

- [ ] Add/extend `validateAndTransformBody` matcher entries for the new/changed schemas (mirror the existing `matcher: "/admin/products/:id/rental-config"` pattern)

---

## Phase 5 — Admin UI

File: `backend/src/admin/widgets/product-rental-config.tsx`

- [ ] Add a `rental_unit` selector (segmented control or select: Hour / Day / Week / Month / Custom)
- [ ] Rename displayed labels from "Min/Max Rental Days" to unit-aware labels ("Min/Max Rental Weeks" etc.), driven by the selected unit
- [ ] Add `security_deposit_type` select (Fixed / % of total) + `security_deposit_amount` number input
- [ ] Add `requires_time_selection` toggle
- [ ] Update the read-only summary view (when a config already exists) to show unit, deposit, and time-selection setting
- [ ] Update the `RentalConfig` TS type in this file to match the extended API response
- [ ] Confirm `upsertMutation` body includes all new fields when saving

File: `backend/src/admin/widgets/order-rental-items.tsx`

- [ ] Show `rental_unit` + `rental_units_count` instead of / alongside raw day count
- [ ] Show pickup/return time if present
- [ ] Show security deposit amount + status (held/refunded/forfeited) as a badge
- [ ] Add a "Manage Deposit" action (opens a small drawer) that calls the new `POST /admin/rentals/:id/deposit` route from 4.4

---

## Phase 6 — Testing checklist (staging)

- [ ] Existing product with day-based `RentalConfiguration` (pre-migration) still shows correct min/max days in admin widget after deploy
- [ ] Existing product still completes a full day-based rental → cart → checkout → order flow with unchanged pricing
- [ ] New product configured with `rental_unit: "week"`, deposit `$75 fixed` — admin widget saves and reloads correctly
- [ ] Same product: store availability endpoint returns correct price for 2 weeks + deposit amount
- [ ] Cart ends up with 2 line items (rental + deposit) after add-to-cart
- [ ] Checkout completes; `Rental` row persisted with correct `rental_unit`, `rental_units_count`, `security_deposit_amount`, `security_deposit_status: "held"`
- [ ] Admin order widget shows deposit; "Manage Deposit" → mark refunded → status updates
- [ ] Cron (`activate-rentals.ts`) still activates pending rentals correctly regardless of unit
- [ ] Order cancellation still blocks/cancels rentals correctly (`validate-order-cancel.ts` hook) regardless of unit
- [ ] `hasRentalOverlap` still correctly blocks overlapping bookings for week/month/hour units (verify the overlap check's date-range logic doesn't assume day granularity anywhere)

---

## Explicitly out of scope for this phase

- Payment authorization holds for deposits (Phase 7, separate plan, sandbox-tested against the payment provider before any production use)
- Multi-unit inventory-aware overlap checking (today's `hasRentalOverlap` treats a variant as a single bookable unit; unrelated to this unit/deposit work, flagged separately if needed)
- Per-vertical (appliances/apparel/vehicles) custom attributes — out of scope, handled via existing Product Categories/Types, not this module
