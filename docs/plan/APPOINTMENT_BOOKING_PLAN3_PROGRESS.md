# Plan 3 — Build status, runbook and verification

Companion to `APPOINTMENT_BOOKING_MODULE_PLAN3.md`. Read this first when picking the work up.

## IMPORTANT: nothing here has been compiled or run

The build was written in a session where every shell command failed (even `echo`), so
no `medusa build`, migration, type-check, unit test, `next build` or browser run
has happened. Everything below is **written but unverified**. Treat the first
`npx medusa build` as the real code review: expect some type errors to fix.
A second pass of independent read-only review was done on the code (see "Review
findings" at the end if present).

## What exists now

| Plan phase | Status | Where |
|---|---|---|
| 0 Safety prep | **Not done** — needs a shell: confirm DB is dev, back it up, create the branch | — |
| 1 Hotfixes | Written | widget Save fix (`api/admin/products/[id]/appointment-config`), exception DELETE routes, approval gate (`api/vendors/shared/require-approved-vendor.ts`), plugin routes locked in `api/middlewares.ts`, date display fixes. **1.8 (admin search by vendor email) is done as business-name search in `api/admin/providers/route.ts`.** |
| 2 Data model | Written | `modules/appointment-booking/models/*`, hand-written migration `Migration20261003090000_appointment_resources_v2.ts`. **No `provider-vendor` link was added** (not needed; vendor names are loaded in one batched query). |
| 3 Availability engine | Written + tests written | `modules/appointment-booking/lib/{availability,timezone,pricing,resource-ops,cancel-token}.ts`; specs in `integration-tests/unit/appointment-*.spec.ts`. Uses the platform `Intl` API, **not luxon** (luxon is only a transitive dependency and adding it would desync the lockfile). |
| 4 Seller API | Written | `api/vendors/resources/**`, `api/vendors/pricing-rules/**`, `api/vendors/appointments/**` |
| 5 Seller UI | Written | `sellers/src/modules/appointments/**`, `sellers/src/app/(panel)/appointments/**`, sidebar entry, `my-schedule` redirects |
| 6 Booking flow | Written | reserve → price → pay → confirm: `workflows/add-to-cart-with-appointment.ts`, `workflows/steps/{prepare,reserve,validate-appointment-holds,confirm-appointment-attendees}`, `workflows/complete-cart-marketplace.ts` (appointment block), `jobs/release-appointment-holds.ts`, buyer cancel, confirmation email (`subscribers/appointment-booked.ts` + template) |
| 7 Buyer API + storefront | Written | `api/store/appointments/**`, storefront `book/**`, `appointments/**`, cart/order/checkout changes, nav links |
| 8 Admin | Written | existing `/admin/providers/**` paths extended (create-for-vendor, edit, services, preview, bookings, cancel/complete, pricing rules read-only) + admin pages rewritten |
| 9 Verification | **Not done** | see checklist below |

## Deviations from the plan (and why)

1. **Admin paths stay `/admin/providers/**`** (not `/admin/resources/**`): the existing screens and the product widget already use them; a second tree would only duplicate code.
2. **Update routes use `POST`, not `PATCH`** (Medusa convention; the sellers proxy supports both).
3. **Slot generation routes are retired** (`POST /vendors/providers/me/slots`, `POST /admin/providers/:id/slots` return 410) because slots are computed live. Their Zod schemas are still exported because `middlewares.ts` imports them.
4. **`GET /store/providers`, `GET /store/providers/:id/available-slots` and `POST /store/carts/:id/complete-appointment` return 410.** The first listed every provider including unapproved vendors; the last re-checked availability after payment. Completion is `POST /store/carts/:id/complete-all` only.
5. **Old workflow/step files are left in place but unused** (`complete-cart-with-appointment.ts`, `steps/validate-appointment-availability.ts`, `steps/create-appointment-attendees.ts`, `steps/create-appointment-slots.ts`, `create-appointment-slots.ts`) because no shell was available to delete files. Delete them once the build is green.
6. **A partial unique index per business** on resource name was added (not in the plan) so a double-submitted "Add resource" cannot create a twin.
7. **A `confirmation_sent_at` column** was added to attendees so a redelivered `appointment.booked` event cannot email the buyer twice.
8. **Appointment status semantics changed** (documented in `workflows/steps/cancel-appointment.ts`): `available` = only held places; `booked` = at least one confirmed attendee; `cancelled` = no live attendee remains (row kept for history; the overlap constraint ignores it so the time is free again).
9. **"Block this slot"** is a one-slot partial-day blackout (no new model). It is refused while that time has live bookings.

## First run — in this order

1. Confirm `DATABASE_URL` points at a dev/staging database; take a backup.
2. `git checkout -b feature/appointment-booking-v2` (the boilerplate folder has its own `.git`).
3. `cd backend && npx medusa build` — fix any compile errors (none could be checked).
4. `npx medusa db:migrate` — applies `Migration20261003090000_appointment_resources_v2`.
5. `npx medusa db:generate appointment-booking` **once** to refresh the module snapshot (`.snapshot-appointment-booking.json`); it will emit a duplicate migration with the same SQL — **delete that generated migration file and keep the updated snapshot**.
6. `npx medusa exec ./src/scripts/backfill-provider-vendor-id.ts` (sets `vendor_id` on pre-existing profiles).
7. Optional, on purpose: `npx medusa exec ./src/scripts/cleanup-empty-appointment-slots.ts` (removes old pre-generated, never-booked slots).
8. `pnpm test:unit` — runs the availability and pricing specs. **Hand-verified only; if one fails, check the test arithmetic before the engine.**
9. Build the sellers app and the storefront (`next build`) and fix type errors.

## Verification checklist (Plan 3, phase 9)

- [ ] Overlap constraint with buffers: in SQL, insert two appointments for one provider whose *buffered* blocks overlap but whose real times do not — the second must fail (`23P01`).
- [ ] Capacity trigger still rejects the (capacity+1)th attendee.
- [ ] Seller: create two resources (different timezones/hours/session/capacity/buffers) → Preview shows different slots; a holiday removes the day; a partial block removes one slot; vendor B gets 404 on vendor A's resource ids; an unapproved vendor gets 403.
- [ ] Buyer: browse → pick resource → slots in own timezone → book as **guest** → pay with a Stripe test card → order exists, attendee `confirmed`, confirmation + vendor emails sent, cancel link works.
- [ ] **Price spike (do first):** a pricing rule changes the cart price. Confirm the custom `unit_price` is charged correctly with this project's tax-inclusive settings (see "Known risks").
- [ ] Concurrency: two simultaneous reservations for the last place → exactly one succeeds. Then bypass the lock in a scratch test and confirm the DB rejects the second.
- [ ] Cheap-variant attack: add an appointment with a variant from a *different* product → rejected.
- [ ] Hold expiry: abandon a cart; after `hold_minutes` the slot is bookable again; checkout after expiry shows the "reservation expired" message and does not charge.
- [ ] Cancel inside/outside the window; slot frees; no refund triggered.
- [ ] Group slot (capacity 3): three bookings succeed, the fourth is rejected.
- [ ] DST: a New York 09:00 rule is 14:00Z in winter and 13:00Z in summer (also covered by the unit tests).

## Review findings (two independent read-only reviews, nothing compiled)

Fixed after review:
- **Blocker:** `workflows/cancel-appointment.ts` interpolated a workflow input inside a template literal (would throw when the module loads and take every cancel route down with it). The lock key is now built in `transform()`.
- **Blocker (storefront):** appointment-only checkout could never place an order because payment-button, review and payment still required a shipping method. All now share `isNoShippingCart` (`storefront/src/types/appointment.ts`).
- Capacity trigger counted lapsed-but-unreleased holds, so a slot could be offered and then refused. A **second migration** (`Migration20261003091000_attendee_capacity_ignores_expired_holds`) fixes the function; the hold-validation step handles the resulting error.
- Hold-release job is now atomic guarded SQL (cannot cancel a hold that checkout just extended or confirmed, cannot close a slot someone just joined, `skip locked` for overlapping runs).
- One shared duplicate/exclusion/capacity error detector (`lib/db-errors.ts`) that accepts Medusa's wrapped `DUPLICATE_ERROR` as well as raw SQLSTATE codes; replaced ten local copies.
- Static ownership-guard unit test extended for the new guard helper; deep vendor paths get explicit auth + approval matchers; hold-spam rate limit on reserve; approved-vendor list read from the database (not a per-process cache); "my bookings" no longer lists system-released holds; hydration mismatch in the slot picker; widget no longer overwrites per-resource session lengths; assorted seller UI fixes.

Both reviewers hand-executed the two unit spec files and reported them passing; that is not a substitute for running them.

Still open (reviewer findings not changed):
- Release job + `reserve-appointment` still take no common lock; the DB constraints are the backstop.
- Cart lines whose holds were released still count toward the 10-appointment cap until removed.
- Admin vendor picker loads each vendor's products (heavy); admin list search does not reset the page; admin modals default dates to the UTC date.
- Server-action error text may be redacted by Next in production builds (same as `tickets.ts`).
- Legacy `providers/me` routes are not ordered when one login has several resources.
- Whether the slot lock is cross-process depends on the configured locking provider (Redis); with the in-memory provider the DB constraints are the only guard.
- `emitEventStep` / `when` / `acquireLockStep` usage follows existing patterns but is unproven until the build and a real checkout run.

## Known risks / open items

1. **Custom price vs tax:** `addToCartWorkflow` is given `unit_price` only when a pricing rule applies (otherwise Medusa prices the variant itself). Confirm tax-inclusive regions total correctly; if not, the item may need `is_tax_inclusive` set from the variant's calculated price.
2. **`QueryContext` for `calculated_price`:** used in `prepare-appointment-booking.ts` and the store routes. Confirm a variant resolves a price for the cart's `region_id`/`currency_code`.
3. **Payment authorised before the hold is re-validated:** with Stripe the payment may already be authorised client-side when `complete-all` runs; if the hold has expired *and been released*, completion fails before the order is created and the authorisation lapses. The hold is extended automatically if the release job has not yet run. Keep `hold_minutes` generous (default 10).
4. **The release job is not locked against the confirm step.** The confirm step can revive a just-released place; if that is no longer possible the buyer sees "payment received but the time could no longer be secured" — an operations case (refund manually). Expected to be very rare.
5. **Approval list for the public business list** uses `onboardingStore.listAll()` (in-memory, loaded at start-up). On a multi-instance deployment a newly approved business may take a restart/refresh to appear; the single-resource routes use a fresh DB read.
6. **`providers/me` legacy routes** (`/vendors/providers/me/*`) still exist for old callers; the sellers panel no longer uses them. Remove once nothing else does.
7. **Out of scope (unchanged):** approval-first booking, reschedule, reminders, calendar sync, automatic refunds, "any available resource", deposits, tiered pricing.
8. **Follow-ups found in the audit but not part of this plan:** the rest of `/vendors/*` is not approval-gated; onboarding KYC uploads silently fake success on failure; the onboarding wizard does not resume at the saved step; `/vendors/onboarding/submit` does not validate; the storefront middleware matches country codes with `includes`, which can mis-route paths such as `/appointments/...` if a region uses a 2-letter code that is a substring (the emailed link carries the country code explicitly to avoid this).
