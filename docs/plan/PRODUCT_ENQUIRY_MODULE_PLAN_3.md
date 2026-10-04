# Product Enquiry Module — Plan 3: Sellers, Enquiry-Only Rule, Storefront

Third document in the series, after `PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN.md` (module, admin widget) and `PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md` (per-product enable + custom fields). Both are implemented on the platform-admin side.

This is the **execution plan**: phase by phase, step by step. Technical detail (routes, helpers, gotchas, test list) lives in `PRODUCT_ENQUIRY_MODULE_PLAN_SELLERS.md`; each phase below says which section to read.

## Build status (2026-10-04)

| Phase | Status |
|---|---|
| 0 Prep | Admin flow covered by the new integration tests (local throwaway Postgres), not run on staging. No git repo here, so no branch was made. |
| 1 Ownership helper | Done: `backend/src/api/vendors/enquiries/helpers.ts`. |
| 2 Seller routes + middleware | Done, tested. |
| 3 Shared fixes | Reply guard already existed in `respond-to-enquiry.ts`. Email now names the product's seller (`storeName`); the email path itself is **not** covered by a test. |
| 4 Enquiry-only + one-mode | Done: `backend/src/lib/sale-mode.ts`, cart block merged into the existing add-to-cart hook, one-mode checks in enquiry, rental, EOI and appointment write paths. Tested for enquiry, rental and EOI. **Appointment and ticketing conflict paths are written but untested.** |
| 5 Admin panel | Enquiry widget: confirm prompt, "enquiry-only" line, server error shown. Rental / Appointment / EOI widgets not yet changed to grey out Enable. |
| 6 Sellers product section | Done: `enquiry-section.tsx`, builder, reply drawer. Typechecks; not exercised in a browser. |
| 7 Sellers Enquiries page | Done: `/enquiries` page + sidebar entry. Not exercised in a browser. |
| 8 Buyer storefront | Done: `EnquiryForm`, server action, wrapper switch. Phone is a country-code picker (no `libphonenumber-js`). Not exercised in a browser. |
| 9 Tests | `backend/integration-tests/http/enquiries/vendor-enquiries.spec.ts`: 14/14 passing (isolation, reply flow, cart block, one-mode for rental and EOI, a real concurrent-enable race, size limits, ordering, seller-name lookup). `appointment-changes/cancel-reschedule` 10/10 still passes. |

Audit pass (same day) fixed:
- **Bug (earlier phase): a product could receive only ONE enquiry.** `links/product-enquiry.ts` and `links/customer-enquiry.ts` had `isList` on the product/customer side, which means one enquiry per product/customer; the second failed with "Cannot create multiple links". `isList` now sits on the enquiry side. Existing databases should run `npx medusa db:sync-links --execute-safe` (not verified on a persistent database).
- **Race:** the one-mode check and its write were not atomic; two simultaneous enables of different modes could both pass. All write paths now take a per-product lock (`withSaleModeLock`); the new race test fails with the lock removed and passes with it.
- **N+1:** the sale-mode check ran five queries per product in a loop; it is now five queries total. The cart hook went from two queries to one. The reply-email seller lookup no longer scans every seller.
- **Hidden errors:** the ownership helper turned any error into a 404; now only NOT_FOUND. The seller UI no longer shows "no enquiries" / "not accepting enquiries" when a request actually failed.
- **Limits:** form fields capped (30 fields, 200-char labels, 50 options); per-product lists ordered and capped by the database.

Findings along the way:
- The store enquiry rate limiter keys on `X-Forwarded-For`, which a client can set, so it can be bypassed. The storefront server action forwards the buyer's IP so buyers do not share one bucket.
- `phase3/complete-all-features.spec.ts` (posts to a removed product-level `eoi-config` route) and `phase3/complete-all-bookings.spec.ts` (store not approved) already fail at their setup, independent of this work.

## Goal

1. Sellers manage enquiries on **their own** products from the sellers panel (same features as the admin widget).
2. A product with enquiries enabled is **enquiry-only**: customers cannot add it to the cart.
3. A product can have **one** sale mode only: Enquiry, Rental, Appointment, EOI or Ticketing.
4. Buyers see an "Ask a question" form on enquiry-only products.

## Decisions (confirmed)

| Decision | Answer |
|---|---|
| Enquiries enabled ⇒ cart blocked? | Always. No per-product toggle. Enforced in the backend, not just by hiding the button. |
| Enquiry together with Rental/Appointment/EOI/Ticketing? | Not allowed, both directions. Turn the other off first. |
| Carts already holding the product when enquiries are enabled | Left alone. Only new adds are blocked. |
| Seller scope | A seller sees/answers only enquiries on their own products. Others return 404. |
| Pending (still to confirm) | Only `pending` enquiries accept a reply (recommended); email footer names the replying seller (recommended); cross-product queue page included (recommended). |

## Pattern followed

Same as Rental/Appointment in the sellers panel: a section component in `sellers/src/modules/products/components/detail/` registered as a `LayoutComposer.Entry` in `product-detail.tsx`; `Drawer` for editing; `useQuery` loading on mount plus `useMutation` that invalidates it; API functions in `lib/data/vendor-client.ts`; backend routes under `/vendors/products/:id/...` that run `assertOwnership` first and then reuse the admin workflow. The only new component is the drag-to-reorder field builder.

---

## Phase 0 — Prep

- [ ] Run the admin enquiry flow end to end on staging (the Phase 7 / Phase F checklists in the first two plans have never been run).
- [ ] Create branch `feature/product-enquiry-sellers`.
- [ ] Confirm the three "pending" decisions above.

## Phase 1 — Seller ownership check (backend)
*Detail: SELLERS plan, Phase 1*

- [ ] New `backend/src/api/vendors/enquiries/helpers.ts`.
- [ ] `assertVendorOwnsEnquiry(req, enquiryId)`: load the enquiry, then run the existing `assertOwnership` on its `product_id`.
- [ ] Missing enquiry and not-yours enquiry return the **same** 404 message.
- [ ] Helper for the vendor's owned product ids; an empty list means "match nothing", never "no filter".

## Phase 2 — Seller routes (backend)
*Detail: SELLERS plan, Phase 2*

- [ ] `GET/POST /vendors/products/:id/enquiry-config`: ownership check, then `upsertEnquiryConfigWorkflow`; reuse the admin zod schema.
- [ ] `GET /vendors/products/:id/enquiries`: ownership check, then list.
- [ ] `GET /vendors/enquiries`: queue across the seller's products, paginated, status filter.
- [ ] `GET/POST /vendors/enquiries/:id`: view and reply (`respondToEnquiryWorkflow`).
- [ ] `POST /vendors/enquiries/:id/status`: close (`updateEnquiryStatusWorkflow`).
- [ ] Add the three body-validation matchers in `middlewares.ts`, mirroring the rental-config entry.

## Phase 3 — Shared fixes (backend)
*Detail: SELLERS plan, Phase 3*

- [ ] `respondToEnquiryWorkflow` rejects when status is not `pending` (admin and seller can't overwrite each other).
- [ ] Email subscriber looks up the product's seller and passes `replied_by`; update `enquiry-responded.tsx` and its type guard. Keep the try/catch.
- [ ] Re-test the admin reply flow.

## Phase 4 — Enquiry-only and one-mode rules (backend, affects admin + sellers)
*Detail: SELLERS plan, Phase 3B*

- [ ] **Cart block:** a Medusa hook accepts only one handler, and `workflows/hooks/validate-ticket-cart-item.ts` already uses `addToCartWorkflow.hooks.validate`. Merge the enquiry check into that handler (keep ticket logic unchanged). One query for all items; throw `NOT_ALLOWED` naming the product.
- [ ] **One mode:** shared helper `assertNoOtherSaleMode(product_id, mode)` called from the enquiry, rental, appointment and EOI upsert workflows (EOI is per variant: any active variant config counts). Ticketing is checked too.
- [ ] **Storefront data:** include `enquiry_configuration.status` and `custom_fields` in the store product response.
- [ ] Regression tests for Rental, Appointment, EOI, Ticketing.

## Phase 5 — Admin panel updates
*Detail: SELLERS plan, Phase 3B "UI warnings"*

- [ ] Confirm prompt before enabling: "This makes the product enquiry-only. Customers won't be able to add it to the cart."
- [ ] Disable "Enable Enquiries" with a reason when another mode is active; same in Rental/Appointment/EOI widgets when enquiries are active.
- [ ] Persistent "Enquiry-only: not purchasable" line while active.

## Phase 6 — Sellers panel: product page section
*Detail: SELLERS plan, Phase 4*

- [ ] Types and functions in `lib/data/vendor-client.ts` (config get/save, list, reply, close).
- [ ] `enquiry-field-builder.tsx`: port of the admin builder (8 field types, required switch, options, drag-to-reorder with the already-installed `@dnd-kit`, confirm on zero fields).
- [ ] `enquiry-section.tsx`: disabled state, enabled state, enquiry list, reply drawer with labelled answers from `custom_fields_snapshot`, close action, empty state.
- [ ] Same warning and disabled-button rules as Phase 5.
- [ ] Register `ProductEnquirySection` in `product-detail.tsx`; test with a seller who already customised their layout.

## Phase 7 — Sellers panel: Enquiries page
*Detail: SELLERS plan, Phase 5*

- [ ] New sidebar entry and `/enquiries` page (gate with `hasProducts` in `feature-access.ts`).
- [ ] Table: product, customer, message, status, date; status filter; pagination.
- [ ] Reuse the reply drawer (extract it into a shared component).
- [ ] Optional: pending-count badge on the sidebar item.

## Phase 8 — Buyer storefront
*New in this plan; the storefront has no enquiry code today.*

- [ ] On a product with active enquiries: hide Add to Cart, quantity and checkout CTAs.
- [ ] "Ask a question" button opening a form built from `custom_fields` (email and message always shown, plus the seller's fields, in the saved order).
- [ ] Country-code phone input that produces E.164 (for example via `libphonenumber-js`); the backend validates, the storefront helps format.
- [ ] Submit to `POST /store/enquiries`; thank-you message; handle errors (invalid answers, product not accepting enquiries, rate limit).
- [ ] Optional later: "My enquiries" page for logged-in customers (the customer link already exists).

## Phase 9 — Tests and sign-off
*Detail: SELLERS plan, Phase 6*

Backend integration tests:
- [ ] A seller cannot read, reply to or close another seller's enquiry (404, same message as a missing id).
- [ ] A seller cannot read or change another seller's enquiry config.
- [ ] A seller with no products gets an empty queue.
- [ ] Reply flow: status becomes `responded`, event fires, email sent with the right name.
- [ ] A second reply is rejected.
- [ ] Enquiry-only product rejected on every add-to-cart route (standard, rental, EOI, appointment, ticket); allowed again once disabled; mixed cart rejected naming the enquiry product.
- [ ] One-mode rule rejected in both directions for each mode.
- [ ] Ticket seat validation still works after the hook merge.
- [ ] Admin-side Phase 7/F tests from the first two plans.

Manual:
- [ ] Seller enables, builds fields, reorders, saves; order persists after reload.
- [ ] Buyer submits as guest and as logged-in customer; both appear in the seller's list on page load.
- [ ] Seller replies; buyer gets the email; admin widget shows the reply.
- [ ] Edit fields after enquiries exist; old enquiries keep their original labels.
- [ ] Disable enquiries: product becomes purchasable again; old enquiries still visible.

---

## Order of work

1. **Foundation:** Phases 0–4 (Phase 4 is the riskiest because it changes existing modules).
2. **Usable for sellers:** Phases 5–6.
3. **Convenience and buyer side:** Phases 7–8.
4. **Sign-off:** Phase 9, with each phase tested as it lands.

## Out of scope

- Second notification channel ("Baba Chat"); it will be an independent subscriber on `enquiry.responded`.
- Public product Q&A, conditional fields, per-field length or regex rules.
- Stripping the product from carts that already contain it.
