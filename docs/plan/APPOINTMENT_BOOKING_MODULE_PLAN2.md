# Appointment Booking — Admin Panel Fix Plan

## Context

Phase 5 of the original build (`APPOINTMENT_BOOKING_MODULE_PLAN.md`) put "My Schedule" and "My Appointments" in the wrong place. This codebase has two separate frontends for two separate audiences:

- `backend/src/admin/` — the **platform admin** dashboard. Every route under `/admin/*` is auto-authenticated by the Medusa framework itself (confirmed by tracing `node_modules/@medusajs/framework/dist/http/router.js` — `ApiLoader` installs a blanket `app.use("/admin", authenticate("user", [...]))` before any custom route loads, independent of anything in `middlewares.ts`). No explicit `authenticate()` call is needed or present on any existing `/admin/*` custom route (confirmed on all 4 rental admin routes).
- `sellers/` — a **separate Next.js app** for vendor logins, authenticated via `/vendors/*` routes that need explicit `authenticate("vendor", [...])` middleware.

"My Schedule" (`backend/src/admin/routes/my-schedule/page.tsx`) and "My Appointments" (`backend/src/admin/routes/my-appointments/page.tsx`) were built inside the **admin** dashboard, but wired to call `/vendors/providers/me/...` — vendor-only routes. An admin session can never authenticate against those, so every call 401s. Confirmed live: clicking "Create provider profile" in the admin dashboard produced `POST /vendors/providers/me 401 (Unauthorized)`.

The one piece of Phase 5 that was built correctly is `product-appointment-config.tsx` — it already calls `/admin/products/:id/appointment-config` and `/admin/providers`, both real `/admin/*` routes. No change needed there.

**Scope of this fix: admin panel only.** Once this works and is verified end-to-end in the admin dashboard, sellers-panel integration is a separate, later task.

## Role clarification (confirmed with the user)

The underlying feature is identical for both admin and sellers — same data, same rules, same screens conceptually. The difference is *how* each role reaches it:

- **Sellers panel** (future work) is the real workhorse — a provider logs in and manages *their own* calendar directly, no picking themselves from a list.
- **Admin panel** (this fix) is a **"god view"** for oversight — a platform admin gets **full manage access** to any provider's calendar, but by convention won't use it unless the seller explicitly asks for a change or a support situation requires stepping in. Full technical access, occasional practical use.

This matches exactly how "Vendors" already works in this codebase: `vendors/page.tsx` (list) + `vendors/[id]/page.tsx` (detail) is an oversight pattern — admins monitor a vendor's store from there, they don't run it day-to-day.

## Root design decision

An admin isn't "a" provider the way a vendor naturally is (a vendor's own token IS their identity; an admin manages *other people's* schedules). So the admin-panel UI needs a **list of providers** first, then a **detail view** for the one you pick — mirroring the exact pattern already proven in `backend/src/admin/routes/vendors/page.tsx` (list, `DataTable` + `useDataTable`) + `vendors/[id]/page.tsx` (detail, route param via `useParams` from `react-router-dom`). Rentals have no equivalent list+detail page to copy (confirmed — no standalone rentals admin page exists at all, only product/order widgets), so `vendors/*` is the correct template here, not rentals.

## Files to add

**New admin API routes** (`backend/src/api/admin/`) — plain `MedusaRequest`/`MedusaResponse` handlers, **no `authenticate()` call**, matching the exact shape of the existing rental admin routes (`admin/products/[id]/rental-config/route.ts`, `admin/rentals/[id]/route.ts`):

- `admin/providers/route.ts` — **already exists**, GET only. Extend it to support `?q=` search and pagination (`limit`/`offset`) like `admin/vendors/route.ts` does, so the list page can paginate.
- `admin/providers/[id]/route.ts` — new. GET: full provider detail (`display_name`, `bio`, `timezone`, `vendor_admin.email`, counts).
- `admin/providers/[id]/recurring-availability/route.ts` — new. GET (list) / POST (create, via the existing `createRecurringAvailabilityWorkflow` — reuse as-is, just pass `provider_id` from the URL param instead of from `req.auth_context.actor_id`).
- `admin/providers/[id]/recurring-availability/[ruleId]/route.ts` — new. DELETE, same logic as the vendor version but without the ownership check (an admin can delete any provider's rule).
- `admin/providers/[id]/exceptions/route.ts` — new. GET/POST, reusing `createAvailabilityExceptionWorkflow` the same way.
- `admin/providers/[id]/slots/route.ts` — new. POST, reusing `createAppointmentSlotsWorkflow` the same way.
- `admin/providers/[id]/appointments/route.ts` — new. GET, same `query.graph` shape as the vendor version.

All three workflows being reused (`createRecurringAvailabilityWorkflow`, `createAvailabilityExceptionWorkflow`, `createAppointmentSlotsWorkflow`) already take `provider_id` as a plain input field — they have no built-in actor-scoping, so pointing them at a URL param instead of `req.auth_context.actor_id` is a legitimate, zero-risk reuse, not a hack.

**Middleware entries** (`backend/src/api/middlewares.ts`) — add `validateAndTransformBody`/`validateAndTransformQuery` entries for the new POST routes' zod schemas, following the exact pattern of the three existing `/admin/rentals*` entries (no `authenticate` call, since `/admin/*` doesn't need one).

**Rewritten admin pages:**

- `backend/src/admin/routes/appointment-providers/page.tsx` — new list page, `DataTable` + `useDataTable` copied from `vendors/page.tsx`'s structure (columns: provider name/email, timezone, status, a "Manage" link to the detail page). Replaces the sidebar nav entry that `my-schedule`/`my-appointments` currently occupy.
- `backend/src/admin/routes/appointment-providers/[id]/page.tsx` — new detail page. Reads `id` via `useParams` (same as `vendors/[id]/page.tsx`). Renders the **same three sections** the current `my-schedule.tsx` + `my-appointments.tsx` already have (weekly hours table + create-modal, exceptions table + create-modal, appointments table) — this body of UI code is correct and doesn't need to be redesigned, only re-pointed at `/admin/providers/${id}/...` instead of `/vendors/providers/me/...`, and re-parented under one page instead of two separate sidebar items.
- Delete `backend/src/admin/routes/my-schedule/page.tsx` and `backend/src/admin/routes/my-appointments/page.tsx` (superseded by the above).
- Update `backend/src/admin/components/create-recurring-availability-modal.tsx` and `create-exception-modal.tsx` to accept a `providerId` prop and call `/admin/providers/${providerId}/...` instead of the hardcoded `/vendors/providers/me/...` path.

**No changes needed:** `product-appointment-config.tsx` (already correct), the appointment-booking module/service/workflows themselves (business logic is sound, only the caller changes), the `/vendors/providers/me/...` routes (left as-is for the future sellers-panel work — not deleted, just not used by the admin panel anymore).

## Verification

1. `npx medusa build` — backend + frontend both compile clean (same check used throughout this project).
2. Open `http://localhost:9000/app`, log in as a platform admin (not a vendor).
3. Navigate to the new "Appointment Providers" list page — confirm it loads without any 401s and lists providers.
4. Click into a provider's detail page — add recurring hours, add a blackout exception, generate slots, confirm the blackout date is correctly excluded — all via the UI, no curl needed, no 401s anywhere (checked via browser devtools Network tab).
5. Confirm the existing product widget (`product-appointment-config.tsx`) still works unchanged — open a product, toggle bookable, assign providers.

This satisfies the instruction: fix and fully test the admin panel first, before any sellers-panel work begins.
