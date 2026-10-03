# Product Enquiry Module — Admin / Backend Plan (Phase 1)

Scope: everything inside `medusajs-2.0-for-railway-boilerplate/backend/`, plus the **platform admin** widget in `backend/src/admin/`. The vendor-facing (sellers app) side is explicitly **out of scope** for this phase — see [Phase boundary](#phase-boundary) below. A companion document, `PRODUCT_ENQUIRY_MODULE_PLAN_SELLERS.md`, will cover it later, mirroring this one.

## Goal

Let a customer ask a question about a specific product ("Is this available in blue?", "Does this ship to Nepal?") without adding anything to their cart, and let the platform admin see and answer it from the product's own admin page — as a self-contained, removable module that does not touch Cart, Payment, or Order in any way.

## Phase boundary

This repo is a multi-vendor marketplace: every product is linked to exactly one `vendor` (`backend/src/links/vendor-product.ts`), and vendors normally manage their own catalogue from a separate Next.js app, `sellers/` (port 7001), not from `backend/src/admin`. The long-term intent (confirmed with the user) is that a vendor answers enquiries on **their own** products from the sellers panel, and the platform admin gets a cross-vendor oversight view from `backend/src/admin`.

**Explicit decision for this phase: build the platform-admin side first, completely, and prove it end-to-end before touching the sellers app.** Consequences of that ordering, so nothing here is a surprise later:

- The data model, links, workflows, and store/admin API routes below are shared infrastructure — the sellers phase reuses all of them unchanged, adding only a `vendors/enquiries/*` route pair and a sellers-app UI section.
- In this phase, **any** admin user can respond to **any** vendor's enquiry from `backend/src/admin`. That is intentional for now (platform admin is trusted staff), not an oversight. Vendor-level write-scoping (a vendor can only touch their own products' enquiries) is enforced later, in the sellers-app phase, via `assertVendorOwns` — see [RENTAL_MODULE_PLAN_ADMIN.md](RENTAL_MODULE_PLAN_ADMIN.md) and `backend/src/api/vendors/shared/vendor-scope.ts` for the existing pattern this will reuse.
- The `product_id` → vendor relationship already exists (`vendor-product.ts`); this phase does **not** add a new `vendor ↔ enquiry` link, since ownership is always derivable transitively through the product, exactly like `rental` derives vendor ownership through `order_id` (see `assertVendorOwnsRental` in `backend/src/api/vendors/rentals/helpers.ts`).

## Decisions already made (do not re-litigate mid-build)

| Question | Decision |
|---|---|
| Who can respond to an enquiry? | Phase 1: any platform admin, for any vendor's product. Phase 2 (sellers): scoped to the owning vendor. |
| Customer identity | Both — `customer_email` always required (works for guests), `customer_id` also captured and linked when the customer is authenticated at submission time. |
| Reply visibility | Private, 1:1. Only the asking customer sees the reply (via their email / future "My Enquiries" page). Not a public product Q&A. |
| Notification channel | Email now, via the existing `email-notifications` module (Resend). A second channel ("Baba Chat", not yet specified) is an explicit future addition — the notification step must be isolated so adding a channel later does not require reworking the workflow. |
| Cart / Payment / Order integration | None. An enquiry is pre-sales and carries no price or line item. The only acceptable future touch point is a subscriber on `order.placed` that auto-closes a customer's open enquiry for that product — optional polish, not required for v1. |
| Widget placement | Platform admin: real Medusa widget, `zone: "product.details"`, in `backend/src/admin/widgets/`. (Sellers-panel equivalent is a `LayoutComposer.Entry`, not a Medusa widget — different mechanism, covered in the Phase 2 doc.) |

---

## Current state (confirmed in codebase)

| Piece | Status |
|---|---|
| `product-enquiry` / `productEnquiry` module | Does not exist — net new |
| Any `enquiry`-related model, link, workflow, route, or widget | Does not exist — confirmed via repo search |
| Precedent for "custom module linked to Product, scoped to vendor via product" | `backend/src/modules/rental/` + `backend/src/links/product-rental-config.ts` + `backend/src/api/vendors/rentals/helpers.ts` (`assertVendorOwnsRental`) — this plan mirrors that shape |
| Precedent for a product-scoped nested admin route | `backend/src/api/admin/products/[id]/rental-config/route.ts`, `backend/src/api/admin/products/[id]/appointment-config/route.ts` |
| Precedent for a custom-module admin widget on `product.details` | `backend/src/admin/widgets/product-rental-config.tsx` |
| Email notification infra | `backend/src/modules/email-notifications/` (Resend-backed `NotificationModuleService` provider), templates registered in `templates/index.tsx`, triggered from **subscribers** (e.g. `backend/src/subscribers/order-placed.ts`), not called directly from workflow steps |
| Custom domain events | None currently emitted in this codebase (`order.placed` / `order.canceled` are core Medusa events; even the fully custom `ticket-booking` module piggybacks on `order.placed` rather than emitting its own event). This plan introduces the **first** custom-emitted event (`enquiry.responded`) via `emitEventStep` from `@medusajs/medusa/core-flows` — standard Medusa capability, just not yet used here. |

---

## Phase 0 — Safety prep

- [ ] Confirm target DB is dev/staging
- [ ] Confirm `medusajs-2.0-for-railway-boilerplate/` is its own git repo (top-level `medusa1` is not); commit any in-progress work first
- [ ] Create a feature branch, e.g. `feature/product-enquiry-admin`

---

## Phase 1 — Module

### 1.1 Data model
New file: `backend/src/modules/product-enquiry/models/enquiry.ts`

```ts
import { model } from "@medusajs/framework/utils"

const Enquiry = model.define("enquiry", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  customer_id: model.text().nullable(),
  customer_email: model.text(),
  message: model.text(),
  reply: model.text().nullable(),
  status: model.enum(["pending", "responded", "closed"]).default("pending"),
  responded_at: model.dateTime().nullable(),
})

export default Enquiry
```

- [ ] Do not add `created_at`/`updated_at`/`deleted_at` explicitly — auto-added by `model.define`
- [ ] `status` starts `"pending"`; moves to `"responded"` when a reply is saved; `"closed"` is a manual admin action for enquiries that don't need a reply (e.g. spam, duplicate)

### 1.2 Service
New file: `backend/src/modules/product-enquiry/service.ts`

```ts
import { MedusaService } from "@medusajs/framework/utils"
import Enquiry from "./models/enquiry"

class ProductEnquiryModuleService extends MedusaService({
  Enquiry,
}) {}

export default ProductEnquiryModuleService
```

No custom service methods needed in Phase 1 — auto-generated CRUD (`createEnquiries`, `listEnquiries`, `updateEnquiries`, etc.) is sufficient; status filtering/ownership scoping happens at the query/route layer, matching how `rental` keeps its service thin and puts overlap logic there only because it's genuinely query-shaped.

### 1.3 Module definition
New file: `backend/src/modules/product-enquiry/index.ts`

```ts
import ProductEnquiryModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PRODUCT_ENQUIRY_MODULE = "productEnquiry"

export default Module(PRODUCT_ENQUIRY_MODULE, {
  service: ProductEnquiryModuleService,
})
```

- [ ] **Module name must be `"productEnquiry"` (camelCase) — never `"product-enquiry"`.** Dashes break `container.resolve()`.

### 1.4 Register in config
File: `backend/medusa-config.js`

- [ ] Add `{ resolve: "./src/modules/product-enquiry" }` to the `modules` array (alongside the existing `rental`, `marketplace`, `ticket-booking`, etc. entries)

### 1.5 Generate + run migrations

- [ ] `npx medusa db:generate productEnquiry`
- [ ] Review generated SQL by hand (one new table, `enquiry`)
- [ ] `npx medusa db:migrate`

---

## Phase 2 — Links

### 2.1 Product ↔ Enquiry
New file: `backend/src/links/product-enquiry.ts`

```ts
import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import ProductEnquiryModule from "../modules/product-enquiry"

/**
 * isList on the product side: a product accumulates many enquiries.
 * Mirrors product-rental-config.ts's shape but as a list link, since a
 * product has many enquiries (rental-config is 1:1).
 */
export default defineLink(
  { linkable: ProductModule.linkable.product, isList: true },
  ProductEnquiryModule.linkable.enquiry
)
```

### 2.2 Customer ↔ Enquiry
New file: `backend/src/links/customer-enquiry.ts`

```ts
import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import ProductEnquiryModule from "../modules/product-enquiry"

/**
 * Optional: only populated when the enquiry was submitted by an
 * authenticated customer. Guest enquiries (customer_id null) have no link
 * row. Enables a future "My Enquiries" storefront page without a schema
 * change.
 */
export default defineLink(
  { linkable: CustomerModule.linkable.customer, isList: true },
  ProductEnquiryModule.linkable.enquiry
)
```

- [ ] **One link definition per file** — do not combine 2.1 and 2.2
- [ ] No `vendor ↔ enquiry` link — see [Phase boundary](#phase-boundary)
- [ ] `npx medusa db:generate productEnquiry` is not needed again for links (link tables are generated separately) — confirm via `npx medusa db:migrate` picking up the new link automatically; if not, check whether this project's Medusa version needs a distinct link-migration command (confirm against `backend/package.json` scripts before assuming)
- [ ] `npx medusa db:migrate`

---

## Phase 3 — Workflows

All new files under `backend/src/workflows/`, following the `create-rentals.ts` / `update-rental.ts` shape (a `createWorkflow` composing one or more steps under `backend/src/workflows/steps/`).

### 3.1 `createEnquiryWorkflow`
New files: `backend/src/workflows/create-enquiry.ts`, `backend/src/workflows/steps/create-enquiry.ts`

- [ ] Input: `product_id`, `customer_email`, `message`, `customer_id?`
- [ ] Step 1: validate `product_id` exists (`query.graph({ entity: "product", filters: { id }, fields: ["id"] })`) — fail fast with `MedusaError.Types.NOT_FOUND` rather than creating an orphaned enquiry row
- [ ] Step 2: create the `Enquiry` row via `productEnquiry` service (`status: "pending"`)
- [ ] Step 3: if `customer_id` present, `createRemoteLinkStep` for the customer↔enquiry link (order matches `defineLink`: customer first, then enquiry — see 2.2)
- [ ] Always `createRemoteLinkStep` for the product↔enquiry link (product first, then enquiry — see 2.1)
- [ ] No event emission needed on create — only on respond (Phase 3.2), since that's the only step a human is waiting on

### 3.2 `respondToEnquiryWorkflow`
New files: `backend/src/workflows/respond-to-enquiry.ts`, `backend/src/workflows/steps/respond-to-enquiry.ts`

- [ ] Input: `enquiry_id`, `reply`
- [ ] Step: update the `Enquiry` row — `reply`, `status: "responded"`, `responded_at: new Date()`
- [ ] Final workflow step: `emitEventStep({ eventName: "enquiry.responded", data: { id: enquiry_id } })` (imported from `@medusajs/medusa/core-flows`) — this is what the Phase 4 subscriber listens for. Emitting the event from the workflow (not the route) keeps the "notify customer" side effect reachable from anywhere the workflow runs later (e.g. a future vendor-facing route in Phase 2), matching how `order.placed`/`order.canceled` decouple side effects from their triggering route today.
- [ ] Compensation: on failure, revert `status` back to `"pending"` and clear `reply`/`responded_at` (mirrors `update-rental.ts`'s compensation pattern)

### 3.3 `updateEnquiryStatusWorkflow`
New files: `backend/src/workflows/update-enquiry-status.ts`, `backend/src/workflows/steps/update-enquiry-status.ts`

- [ ] Input: `enquiry_id`, `status` (`"pending" | "closed"` — `"responded"` is only reachable via 3.2, not this generic setter, so a reply always implies the event fires)
- [ ] Used for the admin "close without replying" action

---

## Phase 4 — Email notification

### 4.1 Template
New file: `backend/src/modules/email-notifications/templates/enquiry-responded.tsx`

- [ ] Follow `order-placed.tsx`'s shape: export the component, an `ENQUIRY_RESPONDED` string constant, and an `isEnquiryRespondedTemplateData` type guard
- [ ] Content: product title/link, the customer's original message, the vendor/admin's reply, a "Reply left by [Store Name]" footer — no pricing, no order data
- [ ] Register in `backend/src/modules/email-notifications/templates/index.tsx`: add `ENQUIRY_RESPONDED` to `EmailTemplates`, add its `case` in `generateEmailTemplate`, re-export the component — mirror the existing 4 entries exactly

### 4.2 Subscriber
New file: `backend/src/subscribers/enquiry-responded.ts`

- [ ] `config: { event: "enquiry.responded" }`
- [ ] Load the `Enquiry` row (+ linked product title) via `query.graph`
- [ ] `notificationModuleService.createNotifications({ to: enquiry.customer_email, channel: "email", template: EmailTemplates.ENQUIRY_RESPONDED, data: {...} })`
- [ ] Wrap in try/catch, `console.error` on failure — mirrors every existing subscriber; a failed email must never throw back into the event bus or fail the admin's "respond" action, which has already saved successfully at this point
- [ ] **Do not** add anything here for the future chat channel — when that's built, it is a second subscriber on the same `enquiry.responded` event (see `ticket-order-placed.ts` / `order-placed.ts` both independently listening to `order.placed` as the precedent for "one event, multiple independent subscribers")

---

## Phase 5 — API routes

### 5.1 Store route — customer submits an enquiry
New file: `backend/src/api/store/enquiries/route.ts`

- [ ] `POST` only, public (no auth middleware — matches `store/products` being publicly readable)
- [ ] zod body schema: `product_id` (required), `customer_email` (required, `.email()`), `message` (required, min length), `customer_id` optional — if the request is authenticated (`req.auth_context?.actor_id` present and of type `customer`), set `customer_id` from the session rather than trusting a client-supplied value
- [ ] Runs `createEnquiryWorkflow`
- [ ] Response: `{ enquiry }` (created row, no internal fields beyond what the model exposes)

### 5.2 Admin routes — platform oversight
New files:
- `backend/src/api/admin/products/[id]/enquiries/route.ts` — `GET`, lists all enquiries for one product (nested under product, mirrors `rental-config`/`appointment-config`'s shape rather than a flat `/admin/enquiries?product_id=`, since every read here is in the context of one product's admin page)
- `backend/src/api/admin/enquiries/route.ts` — `GET`, lists all enquiries across all products/vendors, paginated, filterable by `status` (this is the "queue" view mentioned as a nice-to-have; confirm with user whether a dedicated admin UI route is wanted for this in Phase 1 or deferred — the widget alone covers the per-product view)
- `backend/src/api/admin/enquiries/[id]/route.ts` — `GET` (single enquiry), `POST` (respond — body `{ reply }`, runs `respondToEnquiryWorkflow`)
- `backend/src/api/admin/enquiries/[id]/status/route.ts` — `POST` (body `{ status: "pending" | "closed" }`, runs `updateEnquiryStatusWorkflow`)

- [ ] All admin routes rely on Medusa's built-in `/admin/*` auth middleware (already applied platform-wide) — no per-vendor scoping in this phase, per [Phase boundary](#phase-boundary)
- [ ] Response shape: `{ enquiry }` / `{ enquiries, count, offset, limit }`, matching existing admin route conventions (see `admin/rentals/[id]/route.ts`)

### 5.3 Middleware wiring
File: `backend/src/api/middlewares.ts`

- [ ] Add `validateAndTransformBody` entries for the new zod schemas — `matcher: "/store/enquiries"`, `matcher: "/admin/enquiries/:id"`, `matcher: "/admin/enquiries/:id/status"` — mirror the existing `rental-config` matcher entries exactly

---

## Phase 6 — Platform admin widget

New file: `backend/src/admin/widgets/product-enquiries.tsx`

Follows `product-rental-config.tsx`'s structure and the admin-dashboard-customizations skill's rules exactly:

- [ ] `defineWidgetConfig({ zone: "product.details" })` — **not** `.before`/`.after` (deprecated since v2.17.2; position is now user-arranged in the dashboard's Editor view)
- [ ] Props: `DetailWidgetProps<HttpTypes.AdminProduct>` — receives the current product, reads `data.id`
- [ ] **Display query** (loads on mount, no `enabled` condition): `useQuery(["product-enquiries", product.id], () => sdk.client.fetch(`/admin/products/${product.id}/enquiries`))`
- [ ] List: each enquiry as a row — `customer_email`, truncated `message`, `status` badge, relative `created_at`
- [ ] Clicking a `pending` row opens a `Drawer` (per the forms reference: **Drawer for editing an existing entity**, not FocusModal) with the full message + a reply textarea
- [ ] Reply submit: `useMutation` → `POST /admin/enquiries/:id` → on success, `invalidateQueries(["product-enquiries", product.id])` (display query, per the CRITICAL data-loading pattern — never rely on the modal-only query to refresh the list)
- [ ] Already-`responded` rows show the reply read-only, with a "Close" button (calls the status route) for ones that don't need further action
- [ ] Use `Container`, `Text` (not `Heading` — too small a section per typography rules), `Badge` for status, `size="small"` on all buttons, semantic color classes only (`text-ui-fg-subtle`, etc.) — per `building-admin-dashboard-customizations` skill, load `references/data-loading.md` and `references/forms.md` before writing this file
- [ ] Empty state: "No enquiries yet for this product" (not a spinner-forever or blank div)

---

## Phase 7 — Testing checklist (staging)

- [ ] `POST /store/enquiries` with a valid `product_id` creates a row with `status: "pending"`, both links written (product always, customer only if authenticated)
- [ ] `POST /store/enquiries` with an invalid `product_id` returns 404/400, no row created
- [ ] Guest submission (no auth) succeeds with `customer_id: null`
- [ ] Authenticated customer submission ignores any client-supplied `customer_id` and uses the session's actor id instead
- [ ] Widget on a product's admin page loads its enquiries list on page refresh (not just after interaction) — verifies the display-query-on-mount rule wasn't violated
- [ ] Replying via the widget: `status` flips to `responded`, `enquiry.responded` event fires, subscriber sends the email, customer receives it with the correct reply text and no pricing/order leakage
- [ ] A failed email send (e.g. temporarily break `RESEND_FROM_EMAIL`) does not roll back the saved reply or break the admin route's response — confirms the try/catch isolation in Phase 4.2
- [ ] "Close" action on a pending enquiry sets `status: "closed"` without requiring a `reply`
- [ ] Widget correctly shows **only** this product's enquiries, never another product's — confirms the nested `/admin/products/:id/enquiries` route's filter is airtight
- [ ] Deleting/archiving a product does not orphan its enquiries in a way that crashes the (now-unreachable) widget — confirm the product↔enquiry link's cascade behavior is intentional (this plan does not set `deleteCascade: true`, meaning enquiry rows survive product deletion for record-keeping; revisit if that's not desired)

---

## Explicitly out of scope for this phase

- Vendor-facing response UI in the `sellers/` app, and the `assertVendorOwns`-scoped `vendors/enquiries/*` routes — Phase 2, separate plan (`PRODUCT_ENQUIRY_MODULE_PLAN_SELLERS.md`), to be written once this phase is validated
- Any Cart, Payment, or Order integration
- Public/visible product Q&A (all replies stay private 1:1)
- Second notification channel ("Baba Chat" or otherwise) — the event-based design in Phase 4 exists specifically so this can be added later as an independent subscriber, not a rewrite
- Auto-closing enquiries on `order.placed` — optional polish, flagged but not built here
- A dedicated cross-vendor "Enquiries" admin list page (`backend/src/admin/routes/enquiries/`) — the widget covers the per-product view; a standalone queue page is a fast follow-up once the pattern behind `admin/routes/vendors/` or `admin/routes/venues/` is confirmed as the template to copy
