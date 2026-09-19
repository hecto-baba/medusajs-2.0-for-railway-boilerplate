# Rental Module Plan 2 — Exact-Multiple Validation & Time-Aware Availability

Scope: `medusajs-2.0-for-railway-boilerplate/backend/`, with a later, separate storefront phase. This is a **follow-on** to `RENTAL_MODULE_PLAN_ADMIN.md` / `RENTAL_MODULE_PLAN_STOREFRONT.md` (which shipped hour/day/week/month/custom units and deposits — already implemented and confirmed working end-to-end by code audit). This plan closes two gaps found during that audit:

1. **Gap 1 — Week/month exact-multiple validation.** The backend rounds a date span into a unit count (`Math.round(days / 7)` or `/30`) instead of rejecting spans that aren't a clean multiple of the unit. Unreachable through the storefront (which only ever sends clean multiples via its unit-count stepper), but reachable directly against the public `GET /store/products/:id/rental-availability` endpoint or hand-crafted cart metadata — a trust-boundary bug, not a customer-facing one today.
2. **Gap 2 — Pickup/return time is cosmetic for non-hour units.** `requires_time_selection` collects a pickup/return time that is stored and displayed, but never merged into the start/end timestamp used for pricing or availability. Overlap checking is whole-day granularity regardless. Industry research (Turo, Booqable, Reservety, myTurn, Airbnb, Calendly — see "Industry precedent" below) confirms configurable buffer time + real time-of-day booking is the standard pattern for equipment/tool rental specifically; whole-day-only blocking is a legitimate default only in the vacation-rental category.

Both gaps are fixed **additively**. No existing column is dropped or renamed, no existing rental/order is reinterpreted, and every new behavior defaults to exactly today's behavior until explicitly opted into.

---

## Industry precedent (why Gap 2 is being built, not just documented away)

| Platform | Category | Feature name | Pattern |
|---|---|---|---|
| Turo | Car rental | "Trip Buffer" | Platform-enforced minimum 3 hours between bookings |
| Booqable | Equipment rental (direct analog) | "Padding time" | Configurable before/after, per product, paid-tier feature |
| Reservety | Equipment/RV rental | Automatic buffer blocking | Up to 2 full days for RVs |
| myTurn | Equipment lending | "Reservation Buffers" | Enterprise-tier setting |
| Airbnb | Vacation rental | "Preparation time" | Same-day cutoff through 7-day options |
| Calendly / Skedda / Setmore | Appointment/resource booking | "Buffer time" | Before/after each booking, subtracted from displayed availability |

Conclusion carried into this plan: whole-day-only blocking with no time granularity is a **limitation**, not a legitimate design choice, for an equipment/tool rental platform (this project's category) — it wastes utilization and doesn't match customer expectations for items typically used less than a full day. The fix is **time-aware booking + a configurable buffer**, not time-awareness alone (the buffer is what makes same-day turnover commercially safe against late returns — every platform above pairs the two).

---

## Current state (confirmed in codebase, this audit)

| Piece | File | Relevant detail |
|---|---|---|
| Unit→day-size table | `backend/src/utils/rental-unit.ts` | `{ day: 1, week: 7, month: 30, custom: 1 }` — flat approximation, not calendar-accurate |
| Unit count math | `backend/src/utils/count-rental-units.ts` | `Math.max(1, Math.round(days / unitSizeInDays))` for week/month/custom; separate real-elapsed-minutes branch for hour |
| Day count math | `backend/src/utils/count-rental-days.ts` | UTC-midnight-normalized, inclusive both ends |
| Date/unit validation | `backend/src/utils/validate-rental-dates.ts` | Checks `units < min` / `units > max` and "not in the past"; **no exact-multiple check anywhere** |
| Cart-internal overlap | `backend/src/utils/has-cart-overlap.ts` | Pure in-memory, compares `item.rental_start_date/end_date` against other cart items' metadata; whole-range comparison, buffer-agnostic |
| DB-level overlap | `backend/src/modules/rental/service.ts` → `hasRentalOverlap()`, `listBookedRanges()` | `rental_start_date <= end_date AND rental_end_date >= start_date` against `status IN (active, pending)` — no buffer expansion |
| `RentalConfiguration` model | `backend/src/modules/rental/models/rental-configuration.ts` | Has `requires_time_selection: boolean` already, but nothing consumes pickup/return time for pricing/overlap |
| `Rental` model | `backend/src/modules/rental/models/rental.ts` | `pickup_time`/`return_time` are `model.text().nullable()` — free-form `"HH:mm"` strings, display-only today |
| Call sites needing the exact-multiple / buffer logic | `backend/src/workflows/steps/validate-rental-cart-item.ts`, `backend/src/api/store/products/[id]/rental-availability/route.ts`, `backend/src/workflows/steps/validate-rental.ts`, `backend/src/workflows/hooks/validate-rental.ts` | All four independently recompute unit count / call the overlap checks — every fix must be applied consistently across all four or the gap just moves to whichever one was missed |

**Repo safety fact, checked this session:** the backend's git working tree is **not clean** — current branch `feature/marketplace` has uncommitted appointment-booking work in progress (new admin routes/widgets, new link files, modified `medusa-config.js`/`middlewares.ts`). This plan's Phase 0 must not start on top of that dirty state.

---

## Phase 0 — Safety prep

- [ ] Confirm with the appointment-booking work's owner (or self) whether it should be committed or stashed first — **do not start Phase 1 on a branch with unrelated uncommitted changes mixed in**; either commit the in-progress appointment-booking work as its own commit(s) first, or create this plan's branch from a point that doesn't include it
- [ ] Create a dedicated feature branch off a clean base, e.g. `feature/rental-time-aware-booking`
- [ ] Confirm the target database for testing is dev/staging, not production — this repo is Railway-deployed per `RENTAL_MODULE_PLAN_ADMIN.md`'s own Phase 0; confirm the local `.env`'s `DATABASE_URL` points at a non-production instance before running any migration
- [ ] Take a DB backup/export or confirm point-in-time recovery is available, matching the existing plan docs' convention
- [ ] Re-run `cd backend && npx tsc --noEmit` before starting, to have a known-clean baseline to compare against after each phase

---

## Phase 1 — Gap 1: exact-multiple validation (ship first, independently)

This phase has **no data model changes** and **no interaction with Phase 2** — it is a pure validation tightening, safe to ship and verify on its own before Gap 2 begins.

### 1.1 Add the exact-multiple check

File: `backend/src/utils/validate-rental-dates.ts`

- [ ] After computing `days` and resolving `unit`, for `unit` values that derive from `RENTAL_UNIT_DAY_SIZE` (week, month — **not** hour, which is already exempt, and **not** day/custom, which are always exact by construction since `units === days`), compute `unitSizeInDays = RENTAL_UNIT_DAY_SIZE[unit]` and check `days % unitSizeInDays !== 0`
- [ ] On a non-exact multiple, throw `MedusaError.Types.INVALID_DATA` with a message stating the required alignment, e.g. `` `A ${unitNoun}-based rental must span an exact number of ${unitNoun}s (multiples of ${unitSizeInDays} days). Received a ${days}-day span.` ``
- [ ] Import `RENTAL_UNIT_DAY_SIZE` from `./rental-unit` (already imported as a type in this file via `RentalUnit`; add the value import alongside it)

### 1.2 Confirm all four call sites inherit the fix for free

Since `validateRentalDates` is the single shared validator, confirm (don't re-implement) that these all still route through it unchanged:
- [ ] `backend/src/workflows/steps/validate-rental-cart-item.ts` — calls `validateRentalDates(...)` already; no change needed beyond the shared function
- [ ] `backend/src/api/store/products/[id]/rental-availability/route.ts` — same
- [ ] `backend/src/workflows/steps/validate-rental.ts` — same
- [ ] `backend/src/workflows/hooks/validate-rental.ts` (the `completeCartWorkflow.hooks.validate` hook) — same
- [ ] Grep `backend/src` for any other call site of `validateRentalDates` or of `countRentalUnits` used for pricing without going through `validateRentalDates`, to confirm there is no fifth path that bypasses the new check

### 1.3 Regression safety

- [ ] Confirm every **existing** rental configuration and every **existing** `Rental` row would have passed this check historically — since the storefront has only ever sent exact-multiple spans for week/month (verified: the storefront derives `endDate = startDate + unitsCount * unitSizeInDays`, never a free end-date picker for these units), this check should reject zero real historical bookings
- [ ] Add a quick script or manual query against a copy of the dev DB: for every `rental` row with `rental_unit IN ('week','month')`, confirm `rental_days % RENTAL_UNIT_DAY_SIZE[rental_unit] === 0` — if any historical row fails this, do **not** proceed to enforce rejection until that's understood (it would mean either a bug in this analysis or a row created outside the normal flow)

### 1.4 Testing checklist

- [ ] `GET /store/products/:id/rental-availability` on a week-unit product with a 10-day span → now returns a 400 with the new validation error, not a silently-rounded 1-week quote
- [ ] Same product, exact 7/14/21-day spans → still succeed exactly as before
- [ ] Month-unit product, exact 30/60/90-day spans → still succeed; a 20-day or 45-day span → now rejected
- [ ] Hour-unit and day/custom-unit products → completely unaffected (confirm by re-running existing manual test flows from `RENTAL_MODULE_PLAN_ADMIN.md`'s Phase 6 checklist)
- [ ] Full storefront add-to-cart flow for week/month products, through the actual UI stepper → still succeeds (proves the storefront never needed the rejected inputs in the first place)

---

## Phase 2 — Gap 2: time-aware availability + configurable buffer

This is the larger, higher-risk phase. It changes a load-bearing invariant (whole-day blocking) that every existing `Rental` row was created and validated under. The design below is additive-only and defaults to exactly today's behavior for every product until an admin explicitly opts in.

### 2.1 Design principle: buffer defaults to zero, timestamps already exist

Two facts make this safer than it sounds:
- `rental_start_date` / `rental_end_date` are already `model.dateTime()` columns capable of carrying real time-of-day — hour-unit bookings already populate them with real timestamps today. Day/week/month/custom bookings populate them at UTC midnight. **No column type change is needed.**
- A buffer of `0` minutes, mathematically, makes the new time-aware overlap check produce the **same result** as the old whole-day check for any midnight-to-midnight range (a day-unit rental from `2026-08-01T00:00:00Z` to `2026-08-02T00:00:00Z` still blocks exactly that window). So the migration risk is not "the math changes for old data" — it's "the math becomes capable of finer granularity, which only manifests once someone provides finer-granularity input or a non-zero buffer."

### 2.2 Model changes (additive)

File: `backend/src/modules/rental/models/rental-configuration.ts`

- [ ] Add `buffer_minutes: model.number().default(0)` — per-product turnaround time required before the next booking can start after this one ends. Default `0` = today's behavior exactly (Turo/Calendly convention: buffer defaults to off, operator opts in)
- [ ] Add `availability_granularity: model.enum(["day", "time"]).default("day")` — lets a product stay whole-day-blocked (today's behavior, and a legitimate permanent choice per the vacation-rental precedent) or opt into real time-of-day slot booking. Defaulting to `"day"` means **zero existing products change behavior** on migration
- [ ] Do **not** add a separate "checkout time" / "check-in time" pair distinct from the existing `requires_time_selection` + pickup/return time fields — reuse what exists rather than introducing a second time concept

File: `backend/src/modules/rental/models/rental.ts`

- [ ] No new columns strictly required — `pickup_time`/`return_time` already exist as free-text `"HH:mm"`. The change here is behavioral (Phase 2.4), not schematic: when `availability_granularity === "time"`, these values get merged into the actual `rental_start_date`/`rental_end_date` timestamps at booking time instead of being stored as a separate display-only pair
- [ ] Add `buffer_minutes: model.number().default(0)` as a **snapshot** of the config's buffer at booking time (matches the existing pattern of snapshotting `rental_unit`/`rental_units_count` onto the booking row so a later config change can't retroactively alter an existing booking's rules)

### 2.3 Migration

File: new `backend/src/modules/rental/migrations/Migration<timestamp>_buffer_and_granularity.ts`

- [ ] Run the project's migration-generation command (confirm exact script in `backend/package.json`, matching the convention already used for `Migration20260915190806.ts`) to scaffold from the model diff
- [ ] Hand-review the generated SQL: confirm `buffer_minutes DEFAULT 0` and `availability_granularity DEFAULT 'day'` on both tables, confirm no existing column is touched
- [ ] No backfill statement is needed beyond the defaults themselves — every existing row correctly receives `buffer_minutes = 0`, `availability_granularity = 'day'`, which is precisely "no behavior change" (verify this explicitly rather than assuming: query a sample of existing `rental_configuration` rows post-migration and confirm)
- [ ] Run against dev DB only first; verify with a direct query

### 2.4 Overlap-check logic changes

File: `backend/src/modules/rental/service.ts`

- [ ] Extend `hasRentalOverlap(variant_id, start_date, end_date, buffer_minutes = 0)`: when `buffer_minutes > 0`, expand the comparison window — check existing rentals whose `[rental_start_date - buffer, rental_end_date + buffer]` intersects `[start_date, end_date]`. Implementation approach: widen the incoming `start_date`/`end_date` by the buffer before querying (subtract buffer from `start_date`, add buffer to `end_date`), which is equivalent and keeps the query shape unchanged
- [ ] Extend `listBookedRanges(...)` the same way, since the storefront calendar's blocked-date rendering must reflect the same buffer the actual booking check enforces — a calendar that shows a slot as free when it would actually be rejected at add-to-cart is a worse bug than not having the feature
- [ ] **Explicit regression test**: for `buffer_minutes = 0`, confirm both functions produce byte-identical results to the current implementation for a fixed set of existing test cases (this is the core safety proof for Phase 2 — buffer 0 must be a true no-op)

File: `backend/src/utils/has-cart-overlap.ts`

- [ ] Add an optional `buffer_minutes` parameter, applied the same way (widen the comparison window), defaulting to `0`. Note this function is pure/in-memory — it does not need a DB round-trip to apply the buffer, just adjusted comparison bounds

### 2.5 Where pickup/return time gets merged into real timestamps

File: `backend/src/workflows/steps/validate-rental-cart-item.ts` (and mirrored in `backend/src/api/store/products/[id]/rental-availability/route.ts`)

- [ ] When `rentalConfiguration.availability_granularity === "time"` and `requires_time_selection` is true: combine the date-only `rental_start_date`/`rental_end_date` with the submitted `pickup_time`/`return_time` (`"HH:mm"`) into full timestamps **before** calling `countRentalUnits`, `validateRentalDates`, `hasCartOverlap`, and `hasRentalOverlap` — matching exactly how the existing hour-unit branch already builds a full ISO timestamp from date + time (`storefront/src/modules/products/components/rental-date-picker/index.tsx`'s `toDateTimeInputValue` pattern; mirror that helper's logic server-side rather than trusting a client-built timestamp, consistent with this codebase's existing rule of "server always recomputes, never trusts the client price/date math")
- [ ] When `availability_granularity === "day"` (the default): behavior is **byte-identical to today** — pickup/return time remains display-only, dates stay at UTC midnight, whole-day blocking applies. This is the branch every existing product takes until an admin opts in

### 2.6 Workflow/step updates

- [ ] `backend/src/workflows/steps/validate-rental-cart-item.ts` — thread `buffer_minutes` from the resolved `rental_configuration` into both overlap-check calls; thread the granularity-aware timestamp merge from 2.5
- [ ] `backend/src/workflows/steps/validate-rental.ts` — same two changes, mirrored (this step re-validates at order-creation time and must apply identical logic to the add-to-cart step, per the existing "same checks, two call sites" pattern already used for date/min/max validation)
- [ ] `backend/src/workflows/hooks/validate-rental.ts` — same two changes, mirrored a third time (this is the `completeCartWorkflow.hooks.validate` checkout-time re-check)
- [ ] `backend/src/workflows/steps/create-rentals-for-order.ts` — persist `buffer_minutes` as a snapshot onto the created `Rental` row (per 2.2)
- [ ] Grep for a fourth or fifth call site before considering this phase done — the existing codebase's own bug class (Gap 1) came from exactly this kind of "logic duplicated across call sites, one missed" pattern; do not repeat it

### 2.7 API / admin surface

File: `backend/src/api/admin/products/[id]/rental-config/route.ts` and `backend/src/api/vendors/products/[id]/rental-config/route.ts`

- [ ] Extend the zod schema to accept `buffer_minutes` (optional, non-negative integer) and `availability_granularity` (optional enum `"day" | "time"`)
- [ ] `upsertRentalConfigWorkflow` (and its `create-rental-configuration.ts` / `update-rental-configuration.ts` steps) — accept and persist both new fields, defaulting exactly as the model does when omitted

File: `backend/src/admin/widgets/product-rental-config.tsx`

- [ ] Add a "Turnaround / buffer time" numeric input (minutes, or a friendlier hour/minute picker), shown for every unit — mirrors Booqable's "padding time" being available regardless of the base rental unit
- [ ] Add an "Availability granularity" toggle (Whole day / Time-of-day), gated so it only meaningfully applies when `requires_time_selection` is also on or unit is `hour` (hour-unit products are effectively always `"time"` granularity already — consider defaulting/locking this toggle to `"time"` when unit is `hour`, since that's already the de facto current behavior)
- [ ] Update the read-only config summary view to show the buffer and granularity setting

### 2.8 Rollout order (per-surface, each with a rollback point)

- [ ] **Backend only, buffer off everywhere.** Deploy Phase 2.2–2.6 to staging with every existing product still at `buffer_minutes: 0, availability_granularity: 'day'`. Run the full existing rental regression suite/manual checklist from `RENTAL_MODULE_PLAN_ADMIN.md` Phase 6. Confirm zero behavior change
- [ ] **Admin UI, one test product.** Ship 2.7's widget changes. On a single low-traffic staging product, set a real buffer (e.g. 60 minutes) and `availability_granularity: 'time'`. Manually verify: two bookings on the same day with a gap larger than the buffer succeed; a gap smaller than the buffer is rejected; the blocked-dates calendar reflects the buffer
- [ ] **Storefront**, only after the above is proven — a separate, later phase (not detailed further here; follows the same "extend, don't replace" convention as `RENTAL_MODULE_PLAN_STOREFRONT.md`'s Phase 3): update the date/time picker to expose time-of-day slots when a product's `availability_granularity === "time"`, and surface the buffer implicitly by only showing slots the backend would actually accept (reusing the existing `getRentalBookedRanges` blocked-dates fetch, now buffer-aware)

### 2.9 The one test worth doing deliberately

Matching the appointment-booking module plan's own stated principle for its double-booking guarantee: run an actual **concurrent** test, not an assumed one. Fire two simultaneous add-to-cart/booking requests for overlapping time windows on the same variant with a non-zero buffer configured, and confirm exactly one succeeds — the existing `acquireLockStep({ key: cart_id })` pattern in `add-to-cart-with-rental.ts` locks per-cart, not per-variant, so this test should specifically probe whether two *different* carts booking the same variant at the same time are correctly serialized by `hasRentalOverlap`'s DB read happening inside the validation step before the line item is committed — flag and fix if a race is found (this may already be adequately covered by the existing pending/active status check plus normal DB read-committed isolation, but it has not been verified under actual concurrent load per this audit, only reasoned about).

---

## Explicitly out of scope for this plan

- Late-return grace periods / escalating penalty fees (Turo/Enterprise-style) — a real and reasonable follow-on once buffers exist, but a separate business/payments decision, not bundled here
- Automatic buffer-driven pricing (e.g. charging for the buffer window) — buffer blocks availability only, it is never billed, matching every researched platform's convention (buffer is an internal availability constraint, not a customer-facing/charged line item)
- Per-day-of-week or business-hours-aware buffers (e.g. "no bookings can start before 9am") — out of scope; buffer here is a flat duration, not a calendar-hours concept
- Forcing `availability_granularity: "time"` platform-wide — day-level granularity remains a fully supported, permanent, legitimate choice per product (matches EZRentOut's daily/hourly-per-product convention), not a deprecated fallback

---

## Testing checklist (staging) — full plan

- [ ] **Phase 1 shipped and verified independently before Phase 2 begins**
- [ ] Existing day/hour-unit products: fully unaffected by Phase 1
- [ ] Existing week/month-unit products with historical bookings: confirm none of them would retroactively fail the new exact-multiple check (Phase 1.3)
- [ ] Post-Phase-2-migration, every existing `rental_configuration` row has `buffer_minutes = 0`, `availability_granularity = 'day'`
- [ ] With buffer off everywhere, full existing rental regression checklist (from `RENTAL_MODULE_PLAN_ADMIN.md` Phase 6) still passes unchanged
- [ ] One staging product opted into `buffer_minutes: 60, availability_granularity: 'time'`: same-day back-to-back bookings correctly allowed/rejected based on the buffer
- [ ] Blocked-dates calendar (storefront) reflects buffer-adjusted availability, not raw booking ranges
- [ ] Concurrent booking test (2.9) run at least once against a buffered, time-granular product
- [ ] `npx tsc --noEmit` clean after each phase
- [ ] Admin widget: buffer + granularity fields save, reload, and display correctly; changing them doesn't corrupt existing bookings' snapshotted values
