# Appointment Booking Module — MVP Plan

Scope: `medusajs-2.0-for-railway-boilerplate/backend/`. A new, standalone Medusa module so any service business (not just plumbing) can let staff set up a calendar, publish capacity-limited time slots, and let customers browse + book + pay for an appointment.

## Why a new module instead of the installed `@rsc-labs/medusa-booking-system` plugin

Already installed and registered in `medusa-config.js` under `plugins` — leave it there, untouched, unused. Audited its compiled source directly and confirmed two disqualifying gaps:

1. **No recurring weekly schedule** — its availability rule is a flat one-off date range only. To model "every Tuesday" you'd hand-create one row per week, forever.
2. **No double-booking protection at write time** — the only two places that create a booked slot (`holdBookingResource.js`, `addCartItemWorkflow.js`) never check for an existing overlapping booking before writing, and there's no database constraint either. It only *looks* safe because the calendar UI subtracts existing bookings when it reads — nothing stops two conflicting writes.

Both are core to what you asked for (recurring calendars, safe concurrent booking), so patching them into a third-party plugin is more work than building them right the first time in a small purpose-built module.

## Features being built (MVP)

1. Staff/providers (existing `VendorAdmin` accounts) get their own bookable calendar.
2. Provider sets **recurring weekly hours** (e.g. "Tue/Thu 9am–5pm") plus one-off **exceptions** (blackout a specific day, or add extra hours).
3. Provider (or admin) turns a normal Medusa **Product into a bookable service** and generates real time slots from their recurring schedule for a date range.
4. Each slot has a **max capacity** (1 for a private appointment, N for a group class) and tracks **named attendees**, not just a headcount — so a specific person's booking can be cancelled without guessing.
5. Customer browses a provider's open slots, adds one to cart, pays through the **existing Stripe checkout**, and a real Medusa order is created.
6. **No slot can ever be double-booked**, enforced at the database level, not just in application code.
7. Cancelling a booking frees the slot immediately; refunding money is a **separate, manual** admin action (never automatic) — confirmed decision.

## What's explicitly NOT in this MVP (ship fast, harden later — confirmed decision)

- No automated test suite yet. Correctness is instead protected structurally: a DB constraint that makes double-booking *impossible* regardless of application bugs, and a step-by-step manual verification checklist per phase (Phase 6).
- No automatic refunds.
- No timezone-conversion UI polish beyond storing/displaying each provider's IANA timezone as plain text.
- No mockups/visual design phase — screens are described in terms of existing `@medusajs/ui` patterns already used elsewhere in this admin panel (confirmed decision), so they're visually consistent with the rest of your dashboard by construction, not by separate design work.

---

## How we minimize errors (concrete mechanisms, not aspirations)

- **Double-booking is impossible by construction, not by care.** A Postgres exclusion constraint (`EXCLUDE USING gist`) on `(provider_id, time_range)` rejects any overlapping insert at the database engine level. Even a future bug, a race condition, or a direct SQL script cannot create two conflicting bookings — the database itself refuses the write. This is the single most important error-minimization decision in this plan, and it's the exact protection the RSC Labs plugin was missing.
- **A fast, friendly check happens first**, so users see a clean error instead of a raw DB exception: a lock on the provider/slot id, then an application-level overlap/capacity check, before ever reaching the database. The DB constraint is the backstop, not the primary UX.
- **Every new API route validates its input with zod**, following the exact pattern already used throughout this codebase's `/vendors/*` and `/store/*` routes (see `src/api/middlewares.ts`) — malformed requests are rejected with a clear 400 before touching any business logic.
- **Migrations are additive only.** No existing table, column, or module is modified or dropped. If something goes wrong, the new module can be unregistered from `medusa-config.js` and the rest of the backend is unaffected.
- **Each build phase below ends with a concrete, runnable verification step** — not "should work," but an actual command or request to run and a specific expected result. You'll know exactly where things stand after each phase instead of finding out at the end.

---

## Reused, proven infrastructure (not reinvented)

| Piece | Existing file |
|---|---|
| Staff/provider accounts + auth | `src/modules/marketplace/models/vendor-admin.ts` (email mapped to auth identity via `app_metadata.vendor_id`) |
| Module structure to mirror | `src/modules/rental/` (models/, migrations/, service.ts, index.ts) |
| Overlap-check service method style | `src/modules/rental/service.ts` → `hasRentalOverlap()` |
| Unique-index-in-model + hand-written-migration-constraint pattern | `src/modules/ticket-booking/models/ticket-purchase.ts` |
| Lock → core cart workflow → defensive re-check → compensation pattern | `src/workflows/complete-cart-with-tickets.ts`, `src/workflows/steps/validate-ticket-order.ts` |
| Module link pattern | `src/links/rental-order.ts` |
| "My own record" actor-scoped route pattern | `src/api/vendors/me/route.ts` |
| Real Medusa core cart/payment workflows (proven working via the RSC Labs plugin) | `completeCartWorkflow`, `createPaymentCollectionForCartWorkflow`, `createPaymentSessionsWorkflow` — all from `@medusajs/medusa/core-flows`, Stripe already configured in `medusa-config.js` |
| Admin UI house style to mirror | `src/admin/routes/venues/page.tsx` (Container + Table + create-modal), `src/admin/widgets/product-rental-config.tsx` (product detail widget) |

---

## Phase 0 — Safety prep

- [ ] Confirm target DB is dev/staging (currently pointed at a Railway Postgres instance — confirm this is not the live production DB before running migrations)
- [ ] Confirm `medusajs-2.0-for-railway-boilerplate/` has its own `.git` (it does — `backend/../.git` exists); commit or stash any in-progress work first (`git status`)
- [ ] Create a feature branch, e.g. `feature/appointment-booking`

## Phase 1 — Data model + migrations

New module: `src/modules/appointment-booking/` (mirrors `src/modules/rental/` structure exactly: `models/`, `migrations/`, `service.ts`, `index.ts`).

**Models** (`src/modules/appointment-booking/models/`):

- **`provider.ts`** — `vendor_admin_id` (text, unique — links to `marketplace` `VendorAdmin` via module link, not a direct relation), `display_name` (nullable), `bio` (nullable), `timezone` (text, IANA, per-provider per your decision), `status` (`active`/`inactive`).
- **`recurring-availability.ts`** — `provider` (belongsTo), `day_of_week` (0–6), `start_time`/`end_time` (text `"HH:mm"`, local to provider's timezone), `effective_from`/`effective_until` (dateTime, nullable until), `status`. Indexed on `(provider_id, day_of_week)`.
- **`availability-exception.ts`** — `provider` (belongsTo), `date`, `type` (`blackout`/`extra_hours`), `start_time`/`end_time` (nullable — null = whole-day blackout), `reason` (nullable). Indexed on `(provider_id, date)`.
- **`appointment.ts`** — `provider` (belongsTo), `service_product_id` (text, linked to a real Product), `service_variant_id` (text, nullable, linked to a Variant), `start_time`/`end_time` (dateTime), `max_capacity` (number, default 1), `status` (`available`/`booked`/`cancelled`/`completed`), `order_id` (text, nullable). Indexed on `(provider_id, start_time, end_time)` and `(order_id)`.
- **`appointment-attendee.ts`** — `appointment` (belongsTo), `customer_id`, `order_id` (nullable), `line_item_id` (nullable), `status` (`reserved`/`confirmed`/`cancelled`). Unique index on `(appointment_id, customer_id)`.
- **`service-provider.ts`** — join table backing the product admin widget's provider multi-select: `provider` (belongsTo), `service_product_id` (text, linked to Product), `default_duration_minutes` (number). Unique index on `(provider_id, service_product_id)`. This is what `POST providers/me/slots` reads to know which product a provider is generating slots for, and what the admin widget lists/edits — `Appointment` rows themselves still only ever belong to one provider each (no change to `appointment.ts` above).

`models/index.ts` barrel export. `service.ts` extends `MedusaService({ Provider, RecurringAvailability, AvailabilityException, Appointment, AppointmentAttendee, ServiceProvider })` plus:
- `hasAppointmentOverlap(provider_id, start_time, end_time)` — same query shape as `RentalModuleService.hasRentalOverlap`.
- `countActiveAttendees(appointment_id)`.
- `expandAvailableSlots(provider_id, service_duration_minutes, date_from, date_to)` — pure computation: recurring rules → per-day windows → subtract exceptions → subtract existing non-cancelled appointments → slice into duration-sized slots. Callable directly from a store route, no workflow needed for a read.

`index.ts` registers `Module(APPOINTMENT_BOOKING_MODULE, { service: AppointmentBookingModuleService })`.

**Migrations** (`src/modules/appointment-booking/migrations/`):
- [ ] Write models, then run `npx medusa db:generate appointment-booking` to scaffold the table-creation migration
- [ ] Hand-review the generated SQL — confirm defaults, confirm nothing outside this module is touched
- [ ] Add a **second, hand-written** migration for the double-booking guarantee:
  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE "appointment" ADD COLUMN time_range tstzrange
    GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;
  ALTER TABLE "appointment" ADD CONSTRAINT appointment_no_overlap
    EXCLUDE USING gist (provider_id WITH =, time_range WITH &&)
    WHERE (status != 'cancelled' AND deleted_at IS NULL);
  ```
- [ ] Register the module in `medusa-config.js`: add `{ resolve: './src/modules/appointment-booking' }` to the `modules` array (only change to this file in this phase)
- [ ] Run `npx medusa db:migrate` against dev DB

**Verify Phase 1:** tables exist (`select * from appointment limit 1` succeeds); attempt to manually insert two overlapping rows for the same `provider_id` via a scratch SQL script — the second insert must fail with a constraint violation, not silently succeed.

## Phase 2 — Module links

New files under `src/links/` (all mirror `src/links/rental-order.ts`'s exact `defineLink` pattern):
- `provider-vendor-admin.ts` — `Provider.vendor_admin_id` → `marketplace` `VendorAdmin`
- `appointment-service-product.ts` — `Appointment.service_product_id` → Product
- `appointment-service-variant.ts` — `Appointment.service_variant_id` → ProductVariant
- `appointment-attendee-order.ts` — writable link (via `createRemoteLinkStep`, matching `ticket-purchase-order.ts`'s style) for per-attendee order linkage
- `service-provider-product.ts` — `ServiceProvider.service_product_id` → Product (backs the admin widget's provider multi-select)

**Deviation from the original plan:** a standalone `appointment-order.ts` field-link (`Appointment.order_id` → Order) was attempted first but dropped — Medusa's query-graph builder rejected it with `Conflict configuration for service "appointment_booking". The following aliases are already defined as relationships: order`, because the plain `order_id` column on `Appointment` and the `appointment-attendee-order.ts` link both contend for the same module-level `order` relationship alias, and this holds regardless of explicit `alias:` overrides on either link (confirmed by isolating each link individually — the conflict is tied to the `order_id` field's own auto-generated fieldAlias, not to link naming). `Appointment.order_id` remains as a plain, unlinked text column (still useful for a quick filter/display without a join); the real, queryable path from an appointment to its order is `appointment.attendees.order` via the attendee link, which is also the more correct path for capacity > 1 slots where different attendees may belong to different orders.

**Verify Phase 2:** `npx medusa build` completes with "Types generated successfully" and "Backend build completed successfully" (confirmed) — a scratch admin route using `query.graph` successfully traverses `provider.vendor_admin`, `appointment.service_product`, and `appointment.attendees.order` in one call.

## Phase 3 — Workflows + provider-facing API

**Workflows** (`src/workflows/`, `src/workflows/steps/`):
- `create-recurring-availability.ts`, `create-availability-exception.ts` — straightforward create workflows; validate `day_of_week` range and `start_time < end_time` in a step.
- `create-appointment-slots.ts` — provider materializes real `Appointment` rows for a date range from their recurring pattern (calls `expandAvailableSlots`, bulk-creates rows with `status: "available"`).
- `steps/validate-appointment-availability.ts` — the lock + overlap/capacity check described above (shared by the two workflows below).
- `add-to-cart-with-appointment.ts` — mirrors `add-to-cart-with-rental.ts`: load cart + appointment, lock on `appointment_id`, validate capacity, `addToCartWorkflow.runAsStep(...)` with `metadata: { appointment_id }`, release lock.
- `complete-cart-with-appointment.ts` — mirrors `complete-cart-with-tickets.ts`: lock on `cart_id` → `completeCartWorkflow.runAsStep(...)` → defensive re-check → create `AppointmentAttendee` row(s) → `createRemoteLinkStep` to the resulting Order → compensation cancels the order on failure.
- `cancel-appointment.ts` — cancels an attendee (or whole appointment if sole attendee), frees capacity. No refund logic — manual admin action only.

**Provider-facing API** (`src/api/vendors/providers/...`), reusing the existing `authenticate("vendor", ...)` middleware already wired for `/vendors/*`:
- `providers/me/route.ts` — GET/POST fetch-or-create own Provider row (mirrors `src/api/vendors/me/route.ts`)
- `providers/me/recurring-availability/route.ts` (+ `[id]/route.ts`)
- `providers/me/exceptions/route.ts`
- `providers/me/slots/route.ts` — POST, materializes appointment rows
- `providers/me/appointments/route.ts` — GET own bookings with attendees
- New zod schemas + matcher entries added to `src/api/middlewares.ts`, following the existing pattern for every other `/vendors/*` route

**Verify Phase 3:** via curl/Postman as a vendor-admin session — register recurring hours, add a blackout exception, materialize a week of slots, list them back and confirm the exception correctly removed the expected slot.

## Phase 4 — Storefront cart/checkout

- `src/api/store/providers/route.ts` — GET, list active providers
- `src/api/store/providers/[id]/available-slots/route.ts` — GET, calls `expandAvailableSlots` directly (read-only, matches `store/ticket-products/[id]/seats/route.ts`'s pattern)
- `src/api/store/carts/[id]/line-items/appointments/route.ts` — POST, calls `add-to-cart-with-appointment`
- `src/api/store/carts/[id]/complete-appointment/route.ts` — POST, calls `complete-cart-with-appointment`
- Middleware entries added to `src/api/middlewares.ts` for the above

**Verify Phase 4:**
1. Full flow: browse slots → add to cart → Stripe test payment → order created → `Appointment.status = "booked"`, `AppointmentAttendee` row created and linked to the order.
2. **Double-booking test**: fire two concurrent requests to book the same slot. Confirm the second is rejected with a clean error from the application-level check — then, separately, temporarily bypass the lock in a scratch test to confirm the DB constraint alone would still reject it. This is the one test in this MVP worth doing deliberately, since it's the core correctness guarantee of the whole system.

## Phase 5 — Admin UI

Following the exact `@medusajs/ui` house style already in this codebase (no new visual language — confirmed decision):

- **`src/admin/routes/my-schedule/page.tsx`** — a provider's weekly-hours editor. Layout: a `Container` with a 7-row table (one row per day of week), each row showing existing recurring-availability entries as `Badge`s with a delete action, plus an "Add hours" button opening a `Drawer`/modal (`create-recurring-availability-modal.tsx`) with day-of-week `Select`, start/end `Input` (time), and effective-date range — this is the same Container+Table+create-modal shape as `venues/page.tsx`. Below it, an "Exceptions" section (same table+modal shape) for blackout/extra-hours dates, via `create-exception-modal.tsx`.
- **`src/admin/routes/my-appointments/page.tsx`** — a paginated `Table` of the provider's own appointments (columns: Service, Customer(s), Date/Time, Capacity used/max, Status), same shape as the existing venues/orders list tables in this admin panel, with a row action to cancel.
- **`src/admin/widgets/product-appointment-config.tsx`** (`product.details.after` zone) — mirrors `product-rental-config.tsx`'s "box on the product page, toggle to activate" pattern: a **Bookable** switch plus a **service duration** input (e.g. 30/60 min — this is what slices a provider's working hours into individual slots). Unlike rental config (one config per product, full stop), a service can be offered by more than one provider, so this widget also has a **provider multi-select** (which of your staff offer this service) — selecting a provider here is what makes `POST providers/me/slots` (Phase 3) generate slots for *this* product against *that* provider's calendar. This is a real difference from rental's 1:1 product→config shape, not just a cosmetic addition: `Appointment` rows still belong to exactly one provider each (Phase 1's data model doesn't change), this widget just manages the set of providers allowed to generate slots for the product.
- `src/admin/types/appointment-booking.ts` — shared TS types, mirroring `src/admin/types/ticket-booking.ts`.

**Additional files created beyond the original plan:** `src/api/admin/providers/route.ts` (GET, lists Provider rows with their vendor_admin email - needed for the widget's multi-select, not explicitly called out in the plan text) and `src/api/admin/products/[id]/appointment-config/route.ts` (GET/POST, replaces the full set of `service_provider` rows for a product in one call - the actual persistence layer the widget's "Save" button needed, since the plan described the widget but not its backing admin route).

**Verify Phase 5 — build-level, confirmed:** `npx medusa build` completes with "Backend build completed successfully" and "Frontend build completed successfully" - all new admin routes/widgets/components compile and the admin bundle builds clean. **Not yet done:** an actual click-through in the running dashboard (navigate to My Schedule, add recurring hours and an exception, generate slots via the provider API, confirm they appear correctly in My Appointments once booked from the storefront side) has not been performed.

## Files modified (existing files, additive only)

- `medusa-config.js` — one new entry in the `modules` array. `plugins` array untouched.
- `src/api/middlewares.ts` — new schema imports + matcher entries, following existing conventions. No restructuring of existing entries.

Everything else listed above is new files only — no existing model, service, workflow, or admin route is changed.

## How we know this is actually done (completion checklist)

- [ ] A provider can log in, set recurring weekly hours, and see them reflected correctly
- [ ] A provider can add a one-off blackout day and confirm no slots are generated for it
- [ ] A provider can mark a product bookable and generate a week of real, individually-stored appointment slots
- [ ] A customer can see only genuinely open slots (past bookings and blackout days correctly excluded)
- [ ] A customer can book, pay via Stripe, and receive a real Medusa order
- [ ] Two simultaneous booking attempts on the same slot: exactly one succeeds, the other gets a clean rejection — verified by an actual concurrent test, not assumed
- [ ] Cancelling a booking frees the slot for someone else to book, and does **not** trigger any refund
- [ ] A group-capacity slot (max_capacity > 1) correctly tracks multiple named attendees and rejects a booking once full
