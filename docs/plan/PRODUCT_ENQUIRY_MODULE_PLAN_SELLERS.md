# Product Enquiry Module — Sellers Panel Plan (Phase 2)

Companion to `PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN.md` and `PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md`. Those are implemented on the platform-admin side. This plan makes the same feature available to **vendors** in `sellers/` (Next.js, port 7001), scoped so a vendor only ever touches enquiries on **their own** products.

## Goal

A vendor can, from the sellers panel product page:
1. Turn enquiries on/off for their product and build its custom form fields (same as the admin widget).
2. See the enquiries customers submitted for that product and reply to / close them.
3. Optionally see one queue of all enquiries across their products.

The platform admin keeps its cross-vendor oversight view unchanged.

## Business rule (confirmed): enquiry-enabled = enquiry-only, no cart

**Decision made with the user:** whenever a product's `EnquiryConfiguration.status` is `"active"`, that product **cannot be purchased**. The storefront shows the enquiry form instead of Add to Cart, and the backend refuses cart additions for it. There is no per-product toggle — enabling enquiries *is* the switch.

This **reverses** the "no Cart integration" decision in `PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN.md`. It applies to the platform admin as well as sellers, so it is implemented once in shared backend code (Phase 3B) and surfaced in both UIs. Consequences:

- Enabling enquiries on a product is now a **commercial change** (the product stops being buyable), so both UIs must say so and confirm before enabling (`usePrompt`).
- Disabling (`inactive`) makes the product purchasable again.
- Enforcement must live on the **backend**, not just the storefront button, otherwise anyone can still add it via the API.

## How it works (end to end)

```
Customer (storefront) ──POST /store/enquiries──► createEnquiryWorkflow
        (needs product's EnquiryConfiguration active)        │ saves Enquiry, links product (+customer)
                                                              ▼
Vendor (sellers panel) ──GET /vendors/products/:id/enquiries──► sees list
Vendor ──POST /vendors/enquiries/:id {reply}──► assertVendorOwnsEnquiry
                                                  └► respondToEnquiryWorkflow (SAME workflow admin uses)
                                                       └► emits enquiry.responded
                                                            └► subscriber emails the customer
```

Nothing in the data model, workflows, email, or store route changes. The sellers phase adds a **second set of routes in front of the same workflows**, each guarded by an ownership check, plus a UI.

### Why ownership is derived through the product
An enquiry has no vendor field. `enquiry.product_id → product → vendor` already exists (`links/vendor-product.ts`). This mirrors rentals (`assertVendorOwnsRental` derives through `order_id`). No new `vendor ↔ enquiry` link.

### Security finding that shapes this plan
The existing admin routes (`/admin/enquiries/:id`, `/admin/products/:id/enquiries`, `/admin/products/:id/enquiry-config`) do **no** ownership check — correct for platform admins, unsafe for vendors. Vendors must **not** be pointed at them. New `/vendors/*` routes call an ownership assert first, and answer **404, never 403** ("exists but not yours" must look like "doesn't exist"), per `vendors/shared/vendor-scope.ts`.

## Decisions to confirm before building

| # | Question | Recommendation |
|---|---|---|
| 1 | Can a vendor **also** reply to an enquiry the admin already answered (or vice versa)? | Only `pending` enquiries accept a reply, from either side. Second responder gets `NOT_ALLOWED`. Prevents silent overwrite. Needs a status guard in `respondToEnquiryWorkflow` (small change to shared code). |
| 2 | Who is named in the customer email footer ("Reply left by …")? | The owning vendor's store name when a vendor replies; platform name when an admin replies. Needs the subscriber to look up the product's vendor. |
| 3 | Is a cross-product vendor "Enquiries" queue page in scope? | Yes, as the last phase (Phase 5) — a vendor with 50 products can't hunt through each product page. Product-page section ships first. |
| 4 | Do vendors need to be "approved" before enabling/replying? | Follow whatever the rental-config route does (`vendors/shared/require-approved-vendor.ts`) — confirm how it is applied and copy it. |

---

## Phase 0 — Prep

- [ ] Confirm the admin phase works end to end on staging first (Phase 7/F checklists in the admin plans have not been run — do them now, they are the foundation).
- [ ] Feature branch, e.g. `feature/product-enquiry-sellers`.
- [ ] Confirm decisions 1–4 above.

## Phase 1 — Backend: ownership helper

New file: `backend/src/api/vendors/enquiries/helpers.ts`

- [ ] `assertVendorOwnsEnquiry(req, enquiryId)`: load the enquiry via `query.graph` (`id`, `product_id`); if missing → 404 `"Enquiry not found."`; then call the existing `assertOwnership(req, product_id)` from `vendors/products/helpers.ts` (the same check the rental-config route uses). Both failure paths return the same 404 message.
- [ ] `getVendorProductIds(req)` (or reuse the existing owned-product helper): returns the vendor's product ids; callers must treat `[]` as "match nothing", not "no filter" (rule 2 in `vendor-scope.ts`).
- [ ] Re-export `getVendorId` like other `helpers.ts` files do.

## Phase 2 — Backend: vendor routes

All under `backend/src/api/vendors/`. `/vendors/*` is already authenticated as a vendor in `middlewares.ts`, so only body-validation matchers are added (Phase 2.6).

### 2.1 Config — `products/[id]/enquiry-config/route.ts`
- [ ] `GET`: `assertOwnership(req, id)` → return `{ enquiry_config }` (or `null`).
- [ ] `POST`: `assertOwnership` → `upsertEnquiryConfigWorkflow` (existing). **Reuse the zod schema** from `admin/products/[id]/enquiry-config/route.ts` (`PostEnquiryConfigBodySchema`) rather than duplicating field validation.

### 2.2 Per-product list — `products/[id]/enquiries/route.ts`
- [ ] `GET`: `assertOwnership` → same query as the admin per-product route (including `custom_field_answers` and `custom_fields_snapshot`), newest first.

### 2.3 Cross-product queue — `enquiries/route.ts`
- [ ] `GET`: filter `product_id: <owned ids>`, short-circuit to an empty result when the vendor owns none; paginate (`limit`, `offset`); optional `status` filter; include `product.title`.

### 2.4 Single enquiry — `enquiries/[id]/route.ts`
- [ ] `GET`: `assertVendorOwnsEnquiry` → return the enquiry.
- [ ] `POST` `{ reply }`: `assertVendorOwnsEnquiry` → `respondToEnquiryWorkflow` (existing).

### 2.5 Close — `enquiries/[id]/status/route.ts`
- [ ] `POST` `{ status }`: `assertVendorOwnsEnquiry` → `updateEnquiryStatusWorkflow` (existing).

### 2.6 Middleware
File: `backend/src/api/middlewares.ts`
- [ ] Import the three body schemas; add `validateAndTransformBody` matchers for `/vendors/products/:id/enquiry-config`, `/vendors/enquiries/:id`, `/vendors/enquiries/:id/status` (POST). Mirror the `/vendors/products/:id/rental-config` entry exactly.
- [ ] Do **not** add a custom auth middleware — `/vendors/*` and `/vendors/products/:id/*` already cover it.

## Phase 3 — Backend: shared-code touch-ups (small, affect admin too)

- [ ] **Reply guard** (decision 1): `respondToEnquiryWorkflow`/step rejects when `status !== "pending"`. Check the admin widget only offers reply on `pending` rows (it should), so no admin UX change.
- [ ] **Email footer** (decision 2): in `subscribers/enquiry-responded.ts`, resolve the product's vendor (`product.vendor.name` via the vendor-product link) and pass it to the template as `replied_by`; fall back to the store name. Update `enquiry-responded.tsx` and its type guard. Keep the existing try/catch so a failed email never breaks the reply.
- [ ] Re-run the admin reply flow after this change to confirm nothing regressed.

## Phase 3B — Enquiry-only enforcement (shared: admin + sellers + storefront)

### Backend enforcement
- [ ] **Where:** `addToCartWorkflow.hooks.validate`. Every custom add-to-cart workflow (`add-to-cart-with-rental/eoi/appointment`, `add-tickets-to-cart`) runs `addToCartWorkflow.runAsStep`, so one hook covers all paths. **Gotcha:** a Medusa hook accepts only one handler, and `workflows/hooks/validate-ticket-cart-item.ts` already registers one. Do **not** add a second `addToCartWorkflow.hooks.validate` — it would conflict. Either extend that file's handler (rename it to a general `validate-add-to-cart.ts`, keep the ticket logic untouched, add the enquiry check first) or fold both checks into one handler.
- [ ] **Check:** resolve each added item's `variant_id → product_id`, query `enquiry_configuration` for those products; if any is `active`, throw `MedusaError.Types.NOT_ALLOWED` — "This product is enquiry-only and cannot be added to the cart." One query for all items, not one per item.
- [ ] **Stale carts:** carts that already contain the product when enquiries get enabled. Recommended v1: leave as is (rare, and the hook blocks new adds); optionally strip/flag at checkout later. `completeCartWorkflow.hooks.validate` is already owned by the rental module, so a checkout check would need the wrapper approach used in `complete-cart-with-tickets.ts`.
- [ ] **One mode per product (confirmed by user):** a product can have only one of Enquiry / Rental / Appointment / EOI / Ticketing active. Enabling one while another is active is rejected with a clear message ("Turn off Rental first"). Needs a shared helper (`assertNoOtherSaleMode(product_id, mode)`) called from every upsert workflow — `upsert-enquiry-config` plus the existing rental, appointment and EOI ones (EOI is variant-level: any active variant config counts) — and the UIs should disable the "Enable" button with a reason instead of letting the user hit the error. Touches existing modules, so test each for regressions.
- [ ] **Existing carts (confirmed):** left alone; only new adds are blocked.

### Exposing the flag to the storefront
- [ ] Add `enquiry_configuration.status` (and `custom_fields`, needed to render the form) to the store product response fields so the storefront can decide Add to Cart vs "Ask a question" from the product payload — avoids an extra request per product page. The store product route is a core Medusa route; confirm whether this needs `fields` passed by the storefront or a custom route.
- [ ] Storefront (separate plan, noted here so it isn't forgotten): hide Add to Cart / quantity / price-driven checkout CTAs when active, render the enquiry form from `custom_fields`.

### UI warnings
- [ ] Admin widget (`backend/src/admin/widgets/product-enquiries.tsx`) and the sellers `EnquirySection`: before enabling, `usePrompt` — "Enabling enquiries makes this product enquiry-only. Customers will not be able to add it to the cart." Show a persistent line while active: "Enquiry-only — not purchasable."

## Phase 4 — Sellers panel: product page section

Pattern: copy `eoi-section.tsx` / `rental-section.tsx`.

### 4.1 Data layer — `sellers/src/lib/data/vendor-client.ts`
- [ ] Types: `VendorEnquiry`, `VendorEnquiryConfig`, `VendorEnquiryField` (mirror `utils/enquiry-field.ts`: 8 field types, `id`, `label`, `required`, `order`, `options`).
- [ ] Functions using the existing `request`/`mutate` helpers: `getVendorEnquiryConfig`, `upsertVendorEnquiryConfig`, `listVendorProductEnquiries`, `respondToVendorEnquiry`, `updateVendorEnquiryStatus`.

### 4.2 Field builder component
New: `sellers/src/modules/products/components/detail/enquiry-field-builder.tsx`
- [ ] Port of `backend/src/admin/components/enquiry-field-builder.tsx` (8 types, required switch, option editor, drag-to-reorder, add field, `crypto.randomUUID()` ids, zero-fields confirm via `usePrompt`). `@dnd-kit/*` is already a sellers dependency (used by `layout-composer`). Same `@medusajs/ui` components, so the port is mostly import changes.
- [ ] Do not import across apps (`backend/` ↔ `sellers/`); duplicate the file and note in a comment which file it mirrors, matching how the EOI section mirrors the admin widget.

### 4.3 Section component
New: `sellers/src/modules/products/components/detail/enquiry-section.tsx`
- [ ] Two states, like the admin widget: **disabled** (explanatory copy + "Enable Enquiries" → opens builder) and **enabled** (Active badge, "Edit fields", enquiry list).
- [ ] Display query loads **on mount** (no `enabled` gate); mutations `invalidateQueries` on the display query key.
- [ ] Row → Drawer with message, labelled custom-field answers (labels from `custom_fields_snapshot`, not the live config), reply textarea for `pending`, read-only reply for `responded`, "Close" for ones needing no reply.
- [ ] Empty state: "No enquiries yet for this product".
- [ ] `toast` on success/failure; surface the 404/`NOT_ALLOWED` messages.

### 4.4 Register on the product page
File: `sellers/src/modules/products/components/detail/product-detail.tsx`
- [ ] Add `<LayoutComposer.Entry id="ProductEnquirySection"><EnquirySection product={product} /></LayoutComposer.Entry>` next to the Rental/EOI/Appointment entries.
- [ ] Check whether vendor layouts are persisted (`backend/src/api/vendors/layouts`) and whether a new entry id needs registering or defaults into a zone for existing saved layouts — test with a vendor who already customised their layout.

## Phase 5 — Sellers panel: enquiries queue page (decision 3)

- [ ] Route `sellers/src/app/.../enquiries/page.tsx` following an existing list page's structure (check how `rentals`/`orders` pages and their data tables are built).
- [ ] Table: product, customer email, message (truncated), status badge, date; status filter; pagination; row → same reply Drawer (extract the Drawer from 4.3 into a shared component).
- [ ] Sidebar entry + `isRouteAllowed` handling in `lib/permissions/feature-access.ts` (gate with `hasProducts`, since enquiries hang off products; do not tie it to the existing `ENQUIRY` vendor-type check, which is an unrelated service-vendor classification).
- [ ] Optional: pending-count badge on the sidebar item.

## Phase 6 — Testing

Backend (integration, `backend/integration-tests/http/`):
- [ ] Vendor A cannot `GET`/`POST` enquiry-config of vendor B's product → 404.
- [ ] Vendor A cannot read, reply to, or close vendor B's enquiry → 404 with the same message as a nonexistent id.
- [ ] Vendor with zero products gets an empty queue (not everyone's enquiries — the empty-array pitfall).
- [ ] Vendor reply on own enquiry → `status: responded`, `enquiry.responded` fires, email goes to the customer with the right vendor name.
- [ ] Second reply (admin or vendor) on a responded enquiry → `NOT_ALLOWED`.
- [ ] Vendor config save enforces the same field validation as admin (duplicate ids, empty options).
- [ ] An admin-session token is not required for `/vendors/*`, and a vendor token is rejected by `/admin/*`.
- [ ] Active enquiry config → `POST /store/carts/:id/line-items` for that product is rejected `NOT_ALLOWED`; every custom add-to-cart route (rental, EOI, appointment, tickets) is rejected too.
- [ ] Set config to `inactive` → the same product can be added to a cart again.
- [ ] A cart with a mix of a normal product and an enquiry-only product is rejected as a whole, with the enquiry product named in the message.
- [ ] Ticket seat validation still works after merging the hook (regression).
- [ ] Also write the admin-side Phase 7/F tests (never run) since they share the workflows.

Manual (sellers app):
- [ ] Enable → add all 8 field types → reorder → save → reload: order persists.
- [ ] Submit from the store API as a guest and as a logged-in customer; both appear in the vendor's list on **page load** (not only after interaction).
- [ ] Reply from the Drawer; list refreshes; customer email arrives.
- [ ] Edit fields after enquiries exist; old enquiries still render with their original labels.
- [ ] Disable config: new submissions blocked, existing enquiries still visible and answerable.
- [ ] Platform admin widget still shows the vendor's reply.

## Build order and rough effort

| Phase | Size |
|---|---|
| 0 Prep + decisions | small |
| 1 Ownership helper | small |
| 2 Vendor routes + middleware | medium |
| 3 Shared touch-ups | small |
| 3B Enquiry-only enforcement | medium (hook merge + store fields + warnings) |
| 4 Product-page section + builder port | medium–large (the builder is the bulk) |
| 5 Queue page | medium |
| 6 Tests | medium |

Ship 0→4 + their tests first (vendors fully functional per product), then Phase 5.

## Out of scope

- Storefront "Ask a question" UI and country-code phone input (separate storefront plan).
- Second notification channel ("Baba Chat") — future independent subscriber on `enquiry.responded`.
- Per-product opt-out of the enquiry-only rule (decided: always enquiry-only).
- Auto-close on `order.placed` (moot now — enquiry-only products can't be ordered), public Q&A, conditional fields, per-field length/regex rules.
- Changing the platform-admin widget beyond the reply guard in Phase 3.
