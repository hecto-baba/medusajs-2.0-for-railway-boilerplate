# Rental Module Extension — Storefront / Consumer Plan

Scope: `medusajs-2.0-for-railway-boilerplate/storefront/` (Next.js App Router). This is the customer-facing side. Depends on the backend changes in `RENTAL_MODULE_PLAN_ADMIN.md` being deployed first (new fields on `RentalConfiguration`, extended API responses).

## Important finding

**A working rental picker already exists in this storefront** — this is not a greenfield build. Today it only supports day-granularity, native `<input type="date">` fields, no deposit display, no time-of-day. The work here is to extend it to 5 units + deposit + pickup/return time, matching the interaction model validated in the mockup (rolling windows from today, not calendar-snapped).

## Current state (confirmed in codebase)

| Piece | File |
|---|---|
| Product detail page (server) | `storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx` |
| Product template | `storefront/src/modules/products/templates/index.tsx` |
| Product info section | `storefront/src/modules/products/templates/product-info/index.tsx` |
| Add-to-cart / variant selector + rental integration point | `storefront/src/modules/products/components/product-actions/index.tsx` |
| Mobile sticky add-to-cart bar | `storefront/src/modules/products/components/product-actions/mobile-actions.tsx` |
| **Existing rental date picker** | `storefront/src/modules/products/components/rental-date-picker/index.tsx` |
| Rental API client | `storefront/src/lib/data/rentals.ts` |
| Rental TS types | `storefront/src/types/rental.ts` |
| Cart line item rental display | `storefront/src/modules/common/components/line-item-rental-dates/index.tsx` |
| Cart line item row (uses the above) | `storefront/src/modules/cart/components/item/index.tsx` |
| Cart page | `storefront/src/app/[countryCode]/(main)/cart/page.tsx` → `storefront/src/modules/cart/templates/{index,items}.tsx` |
| Order line item display | `storefront/src/modules/order/components/item/index.tsx` |
| Cart dropdown (header) | `storefront/src/modules/layout/components/cart-dropdown/index.tsx` |

Styling: `@medusajs/ui` (v4.2.1) + Tailwind (`@medusajs/ui-preset`), plain elements with Medusa UI design tokens (`text-ui-fg-base`, `bg-ui-bg-field`, `border-ui-border-base`, `txt-medium`), `data-testid` on interactive elements throughout — match this convention exactly, don't introduce a different component library.

No date-picker library installed (no `react-day-picker`/`react-datepicker`/`date-fns`). Current picker uses native `<input type="date">`. **Decision needed**: the agreed design (calendar with visibly blocked/booked dates, click-to-select) is hard to do well with native date inputs, which can't visually strike through individual unavailable dates. Recommend introducing a lightweight calendar library for the new picker — see Phase 1.

---

## Phase 0 — Safety prep

- [ ] Confirm backend Phase 1–4 (from the admin plan) are deployed to the same environment this storefront points at, since the new picker depends on the extended `RentalConfiguration` shape and the extended availability response
- [ ] Confirm `.env` / `NEXT_PUBLIC_MEDUSA_BACKEND_URL` points at that environment before testing
- [ ] Create/continue the same feature branch used for the backend work, or a paired `feature/rental-units-storefront` branch if the storefront is a separate repo/deploy

---

## Phase 1 — Dependencies & types

- [ ] Decide on a calendar library: `react-day-picker` is the lightest, Tailwind-friendly, and commonly paired with `@medusajs/ui`-styled storefronts — recommended over building a custom calendar grid by hand, since we already validated the desired interaction in the mockup and don't need to re-invent date-grid math. Add via the project's package manager (check `storefront/package.json` for whether it's npm/yarn/pnpm).
- [ ] Extend `storefront/src/types/rental.ts`:
  - [ ] `RentalConfiguration`: add `rental_unit: "hour" | "day" | "week" | "month" | "custom"`, `min_rental_units: number`, `max_rental_units: number | null`, `security_deposit_amount: number`, `security_deposit_type: "fixed" | "percentage"`, `requires_time_selection: boolean`. Keep `min_rental_days`/`max_rental_days` in the type as optional/deprecated so any code still reading them doesn't break during rollout.
  - [ ] `RentalAvailability`: add `deposit: { amount: number; type: "fixed" | "percentage" }`
  - [ ] `RentalSelection`: add `rental_unit`, `rental_units_count`, `pickup_time: string | null`, `return_time: string | null` (keep existing `rental_start_date`/`rental_end_date`/`rental_days` — still needed, `rental_days` stays the day-equivalent for server validation)
  - [ ] Add a new `BlockedDateRange` or `UnavailableDate` type if the availability endpoint is extended to return blocked dates for calendar rendering (see Phase 2)

---

## Phase 2 — API client changes

File: `storefront/src/lib/data/rentals.ts`

- [ ] Update `getRentalAvailability()` call signature to pass `rental_unit` and `rental_units_count` (or keep passing `start_date`/`end_date` and let the server derive units — match whatever the backend plan's Phase 4.3 settles on; recommended: server derives, storefront just sends dates/day-count so there's one source of truth for the math)
- [ ] Update the return type mapping to include the new `deposit` field from the response
- [ ] **New**: add a function to fetch blocked/booked dates for a variant ahead of rendering the calendar, e.g. `getRentalUnavailableDates({ productId, variantId, monthsAhead })`. Check whether this requires a new backend endpoint (likely yes — today's `hasRentalOverlap` only answers "is this specific range free," not "give me all blocked dates in a month"). **Flag this as a backend-plan addition** if not already covered — add a lightweight `GET /store/products/:id/rental-blocked-dates?variant_id=&from=&to=` route that queries existing `Rental` rows with status `pending`/`active` in the range and returns the date list, reusing the same query pattern as `hasRentalOverlap`.

---

## Phase 3 — Rebuild `RentalDatePicker` per unit

File: `storefront/src/modules/products/components/rental-date-picker/index.tsx` (extend, don't replace wholesale — keep the existing local-validation-before-server-check pattern, the request-race-guard `requestRef`, and the `data-testid` attributes, since those are good, deliberate patterns already in place)

- [ ] Add a `rental_unit` prop (from `rentalConfiguration.rental_unit`) and branch rendering:
  - **Hour**: render a day picker (defaults to today) + a time-slot grid for start/end hour on that single day — mirrors the mockup's `HourUnitPicker`
  - **Day**: keep close to current behavior — start date (default today) + end date, but replace native inputs with the calendar library so already-booked dates render struck-through/disabled instead of just failing validation after the fact
  - **Week / Month**: start date (default today, rolling — NOT calendar-week/month-snapped, per the confirmed design) + a stepper for unit count (1, 2, 3…), end date computed and shown read-only
  - **Custom**: start date (default today) + a plain day-count number input/stepper (min/max enforced from config)
- [ ] Add pickup-time / return-time selectors (chip row or native `<select>`, matching Medusa UI form conventions) shown whenever `rentalConfiguration.requires_time_selection` is true — for **every** unit, not just Hour, per the confirmed design
- [ ] Default the start date state to `today` (via `toDateInputValue(new Date())`, already present as a util in this file) instead of empty string, so the calendar opens with today pre-selected as designed
- [ ] Replace/extend `countRentalDays` usage: keep it for the day-equivalent count sent to the server, but derive the unit-facing quantity (`rental_units_count`) via the shared logic pattern from the mockup (day = raw count, week = `spanDays / 7`, month = `spanDays / 30`, custom = raw count, hour = handled separately)
- [ ] Update `localValidationError` messages to be unit-aware ("minimum of 2 weeks" instead of always "days")
- [ ] Wire the blocked-dates fetch (Phase 2) into the calendar library's `disabled` matcher so unavailable dates are visually struck through, matching the mockup — this is a UX upgrade over today's "submit and find out" pattern
- [ ] Extend `onSelectionChange`/`onPriceChange` callbacks to also surface the deposit amount from the availability response (new callback `onDepositChange`, or fold into a single richer selection object — recommended: extend `RentalSelection` to carry `deposit_amount` rather than adding a third callback prop)

---

## Phase 4 — Deposit display

- [ ] In `rental-date-picker/index.tsx`, add a deposit line beneath the price/availability message once dates are valid and priced: "+ $75.00 refundable security deposit", styled distinctly (e.g. `text-ui-fg-subtle` with a small badge/icon) so it reads as separate from the rental price, matching the mockup's amber-highlighted deposit row
- [ ] In `storefront/src/modules/common/components/line-item-rental-dates/index.tsx`, add rendering for deposit amount if `item.metadata.is_rental_deposit` line item exists as a sibling, OR if the deposit is stored as metadata on the rental line item itself — depends on which approach Phase 3.4 of the backend plan lands on (separate line item vs. metadata-only). Confirm with backend implementation before finalizing this component.
- [ ] In `storefront/src/modules/cart/components/item/index.tsx`, ensure the deposit line item (if implemented as a real second cart line item per backend Phase 3.4) renders clearly labeled as "Security Deposit" and not as a confusing duplicate product row — may need a small conditional render tweak so it doesn't show a product thumbnail/variant selector like a normal line item
- [ ] Same check for `storefront/src/modules/order/components/item/index.tsx` (order confirmation / order history view) and `storefront/src/modules/layout/components/cart-dropdown/index.tsx` (header mini-cart)

---

## Phase 5 — `product-actions` integration

File: `storefront/src/modules/products/components/product-actions/index.tsx`

- [ ] Confirm `isRental` derivation still works unchanged (based on `product.rental_configuration` presence) — no change expected here
- [ ] Pass the new `RentalConfiguration` fields through to `<RentalDatePicker>` (unit, deposit, requires_time_selection)
- [ ] Update the "Add rental to cart" call to include `rental_unit`, `rental_units_count`, `pickup_time`, `return_time` in the request body sent via `addRentalToCart` (`storefront/src/lib/data/rentals.ts`)
- [ ] Update button/price display logic if it currently assumes a day-based price format

File: `storefront/src/modules/products/components/product-actions/mobile-actions.tsx`

- [ ] Mirror the same prop/callback changes for the mobile sticky bar (`isRental`/`hasRentalSelection` pattern already exists — extend, don't restructure)

---

## Phase 6 — Testing checklist (staging)

- [ ] Existing day-rental product still renders and books correctly through the updated picker (regression check — this is the most important test since the picker is being restructured)
- [ ] New week-unit product: start date defaults to today, stepper changes weeks, end date updates correctly, price recomputes
- [ ] New month-unit product: same, with 30-day rolling spans
- [ ] New hour-unit product: day picker + time-slot grid works, already-booked hours correctly disabled
- [ ] New custom-unit product: day-count input respects min/max from config
- [ ] Deposit line renders correctly for a product with `security_deposit_type: "percentage"` vs `"fixed"`
- [ ] Cart page shows rental line item + deposit line item (or combined display) clearly, with correct dates/times/amounts
- [ ] Mini-cart (header dropdown) doesn't break/overflow with the extra deposit line
- [ ] Order confirmation page shows the same rental + deposit info correctly after checkout
- [ ] Mobile viewport (~400px) — picker, calendar, and deposit line all remain usable, no horizontal overflow
- [ ] Switching product variant after picking rental dates correctly re-triggers availability check (existing behavior — confirm it isn't broken by the refactor)

---

## Open questions to resolve before/during implementation

- [ ] Confirm with backend plan whether deposit is a second cart line item or line-item metadata — this determines Phase 4's exact implementation
- [ ] Confirm whether a new `rental-blocked-dates` endpoint is acceptable scope-wise, or whether Phase 3's calendar should skip pre-emptive blocked-date rendering and keep today's "try dates, get told if unavailable" pattern for this iteration (smaller scope, matches current behavior more closely, defers the calendar-library addition)
- [ ] Confirm package manager and whether adding `react-day-picker` (or equivalent) is acceptable, vs. hand-rolling the calendar grid in React/Tailwind the way the mockup did (no new dependency, more code to maintain)
