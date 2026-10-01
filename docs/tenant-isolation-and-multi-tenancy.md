# Tenant Isolation and Multi-Tenancy Plan

Status: Phase 0 complete; Phase 1 next. Branch: `feature/tenant-isolation` (off `feature/marketplace`).
Scope: the seller (vendor) API `backend/src/api/vendors/**`, the seller panel `sellers/`, and bringing the missing admin features to sellers.
Out of scope: Vendor Transactions (stays admin-only), drivers, and the admin API / store routes (see "What this plan does not cover").

---

## 1. Goal

Every seller sees and changes only their own data, through every route and every screen. Any seller who types another seller's id by hand gets a 404. Every admin feature (except Vendor Transactions) exists for sellers, built on the same isolation rules.

## 2. How isolation works today (as read from the code)

- Sellers are a custom auth actor type `vendor`. Registration is three calls (`/auth/vendor/emailpass/register`, `POST /vendors`, then login). The token carries `actor_id` = the `vendor_admin` id.
- The seller panel (`sellers/`, Next.js) calls a same-origin proxy `app/api/vendors/[...path]/route.ts`, which attaches the token and forwards to the backend `/vendors/*`. The proxy has no path allow-list, so the backend is the only security boundary.
- Ownership is stored as module links (`backend/src/links/vendor-*.ts`): product, order, customer, customer group, inventory item, stock location, sales channel, category, collection, product option, tag, type, promotion, campaign, price list, API key, return reason, refund reason, venue.
- Isolation is enforced per handler in application code: resolve `actor_id` -> `vendor_admin` -> `vendor`, filter lists to owned ids, assert ownership on `:id` routes, return 404 (never 403). The database has no row-level protection.
- Four documented rules (`sellers/PRODUCTS.md`): scope on `actor_id`; guard ids in request bodies; short-circuit empty id lists; return 404.
- There are no tests in the backend or in `sellers/`.

## 3. Findings

Legend: **V** = verified by reading the code myself. **R** = reported by a code audit, not yet re-read. **U** = uncertain, must be checked at runtime (Phase 0).

### 3.1 By-id routes with no ownership check

| Route | Impact | Status |
|---|---|---|
| `api-keys/[id]` GET/POST/DELETE, `api-keys/[id]/revoke` | Read, change, delete or revoke any key, including the platform's (e.g. the storefront's publishable key, which would break the shop). Sellers can also create `secret` keys. Runtime probe: the secret key's token is never returned to the seller, so admin-level escalation was **not demonstrated** | V (by-id), probe (escalation not shown) |
| `team/[id]` GET/POST/DELETE | Read, rename, delete any seller's admin account | V |
| `stock-locations/[id]` GET/POST/DELETE | Read, edit, delete any stock location | V |
| `draft-orders/[id]` GET/DELETE, `draft-orders/[id]/convert` | Read (customer + addresses), delete, convert any draft order | V |
| `product-tags/[id]`, `product-types/[id]`, `product-options/[id]` | Read, edit, delete | V |
| `shipping-profiles/[id]`, `tax-regions/[id]` | Edit/delete shared platform config. `tax-regions/[id]` POST rewrites a platform tax rate through raw SQL | V |
| `sales-channels/[id]` POST/DELETE | Edit or delete any sales channel | V |
| `products/imports/[transaction_id]/confirm` | Confirm another seller's or the admin's pending import | V |
| `collections/[id]` POST/DELETE | Edit or delete any collection | R |
| `customers/[id]/addresses/[address_id]` DELETE | Delete another customer's address (only the customer id is checked) | R |
| `price-lists/[id]/prices/batch` | `delete[]` price ids not bound to the list | R |
| `shipping-option-types/[id]` | Edit/delete shared config | R |

### 3.2 Lists that return store-wide data

| Route | Impact | Status |
|---|---|---|
| `search` | `entity=customer` returns every customer's name, email, phone; `entity=inventory` returns every inventory item (`filters: {}`) | V |
| `stock-locations` GET | Returns all locations when the seller has none | V |
| `shipping-profiles` GET, `shipping-option-types` GET, `tax-regions` GET, `regions` GET | Entire table, no scoping | V (profiles, tax regions), R (others) |
| `sales-channels` GET and `[id]` GET | All channels, plus `products.id` of every product | R |
| `taxonomy` | Stock-location fallback returns all locations with addresses | R |
| `notifications` | `to:""` and `channel:"feed"` branches return platform-wide rows. Runtime probe: a feed notification addressed to someone else was returned to a different seller | V (runtime) |
| `workflow-executions` | Scoped by text match over raw JSON, not a real filter | R |

### 3.3 Body-supplied ids not validated as owned

| Route | Field | Status |
|---|---|---|
| `draft-orders` POST | `customer_id`, variants, region, sales channel, shipping option, promo codes. A seller can claim any customer, and the order-linked-customer helper then treats that customer as theirs | R |
| `inventory-items` POST, location-levels routes (4), `reservations` | `location_id` | R |
| `products/[id]/variants/[vid]/inventory-items`, `variants/inventory-items/batch` | `inventory_item_id`. Attaching a foreign item links the seller to it, which opens foreign stock | R |
| `products` POST | `stock_location_id`, first-location fallback | R |
| `product-options` POST | `product_id` | R |
| `providers/me/slots` | `service_product_id`, `service_variant_id` | R |
| `products/imports` | CSV id pre-check bypassable by shifted columns; `file_key` not tied to the caller | R |
| `customers/[id]/customer-groups`, `customer-groups/[id]/customers` | `remove` ids | R |
| `sales-channels/[id]/products`, `collections/[id]/products`, `categories/[id]/products` | target channel/collection/category id | R |
| `campaigns` POST/update, promotion rule batches | possible foreign promotion/rule ids | U |

### 3.4 Structural findings

- Shipping profiles, shipping option types, tax regions and regions have **no vendor link**. They are shared across all sellers today.
- The vendor-created stock location has **no fulfilment set, service zone, provider link or sales channel link**, so it cannot serve shipping or take reservations (`workflows/create-vendor-stock-location.ts`).
- Medusa lists shipping options per cart by sales channel and ignores the vendor or shipping profile of the items. The storefront shows one flat list and keeps only the last choice.
- Medusa allows **one tax region per country store-wide** (unique index), so sellers cannot own tax regions.
- Medusa core assumes **one order per cart** and one payment collection per cart. Its own code says split payments are not supported. There is **no order splitting in this repo**; the comment in `links/vendor-order.ts` claiming it is wrong. A multi-seller cart gives one order linked to several sellers, trimmed per seller afterwards (only items are trimmed; payment, shipping, fulfilments and customer data are returned in full).
- Stripe config has no Connect/payout support, and Medusa's partial capture amount is not forwarded to Stripe.
- Many custom flows assume one order per cart: tickets, rentals, EOI, digital products, appointments, emails, the `link-vendor-order` subscriber, cancel hooks, restaurant delivery (already creates a second order with no payment link), quotes (draft orders get no seller link and never emit `order.placed`).
- The storefront sends a mixed cart to only one completion endpoint (tickets, rentals, digital, or standard).
- There are no seller fulfilment, cancel, refund or return routes or screens.
- Imported products are not linked to the seller (orphans).
- Seller panel: capability flags only hide sidebar items; `isRouteAllowed()` is never called; no client-side 401 handling.

### 3.5 Things deliberately shared

Regions, country tax regions, shared taxonomy (category and collection lists), published product listings on the storefront, and public product image URLs. Customers who ordered from a seller stay readable by that seller (see Decisions).

## 4. Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Customer visibility: a seller can read customers who ordered from them, with limited fields; writes only for customers the seller created. Stricter marketplace norm (customer visible only through an order to fulfil, no directory/search) can be adopted later | **Decided: keep as is** |
| D2 | Seller payouts: Stripe Connect or a platform-held payout ledger | **Open** (needed before Phase 3 step 5) |
| D3 | Is the database in `backend/.env` a development database? | **Open** (needed before Phase 0 step 1 testing) |
| D4 | Seller tax is done with a seller-owned rate model and a custom tax provider (country tax regions stay platform-owned because of the unique-per-country index) | Proposed; verify the 2.19 custom tax provider API first |
| D5 | Orders are split into a parent order (holds the payment) plus one child order per seller, per Medusa's marketplace recipe | Proposed |
| D6 | Regions stay platform-owned and read-only for sellers (a cart picks one region per country) | Proposed |

## 5. Rules for every step

1. One commit per numbered step, on a new branch off `feature/marketplace`.
2. Every fix ships with its cross-seller test: seller A uses seller B's id on read, update and delete and must get 404; seller A still works on A's own data. List routes: A must never see B's rows, even when A has none.
3. A route that takes an id calls the ownership guard first. A list route filters to owned ids and returns empty when there are none, never "all".
4. Create routes link the new row to the seller inside a workflow (`createRemoteLinkStep`).
5. Return 404, never 403, for non-owned ids.
6. Each phase ends with a gate: all tests pass, `tsc --noEmit` (backend), `pnpm typecheck` and `pnpm lint` (`sellers/`).
7. Anything marked U is checked in the code or at runtime before relying on it.

---

## 6. Phases

### Phase 0: Foundation (COMPLETE, see section 7)

1. **Environment.** Resolve D3. Create the branch off `feature/marketplace`. Copy the files that will be touched to a backup folder.
2. **Runtime checks on the uncertain items** (U above):
   - Does `/vendors/*` authenticate deep paths? Static reading of Express 4.22.2 (`path-to-regexp` 0.1.13) says `*` crosses `/`, while comments in `middlewares.ts` say it does not.
   - Can a seller-minted `secret` API key call the admin API?
   - What do platform `feed` notifications contain?
   - Does the campaign create body accept a `promotions[]` id list?
   - Do the `layouts/*` routes do anything (Settings module methods are not defined in `src`)?
3. **Read-only data report on the database:** seller-linked secret API keys, resources with no owner (shipping profiles, tax regions, sales channels, stock locations), orders linked to several sellers, imported products with no seller link.
4. **Shared guard.** Replace the four copies of `getVendorId` (`products/helpers.ts`, `shared/vendor-scope.ts`, `customers/helpers.ts`, `venues/helpers.ts`) and the inline copies with one helper. Extend `shared/vendor-scope.ts` with generic `getOwnedIds`, `assertVendorOwns`, `assertVendorOwnsAll` for every link type. Correct the wrong comments in `links/vendor-order.ts` and `shared/vendor-scope.ts`.
5. **Test harness.** Add `medusaIntegrationTestRunner` from `@medusajs/test-utils` (already a devDependency), a jest config and a `test` script in `backend/package.json`. Fixtures: seller A and seller B with their own data. A helper to call routes as either seller.
6. **Coverage check.** A test that enumerates every route under `api/vendors` and fails if a route has no ownership guard or no negative test.
7. **Middleware.** Add explicit `authenticate("vendor", ...)` entries for any uncovered path (for example `layouts/:zone/configuration`), based on step 2.

**Gate:** the harness runs and the first two-seller test passes.

### Phase 1: Isolate everything that exists today

For each item: ownership check on read, update and delete; 404 for non-owners; the list returns only the seller's rows with no store-wide fallback; a cross-seller test.

1. **API keys** (`api-keys/[id]`, `[id]/revoke`). Sellers cannot create `secret` keys.
2. **Team** (`team/[id]`). Limit to the seller's own team. Verify that a seller-created invite cannot be accepted into another seller or the admin (invite accept flow not yet read).
3. **Stock locations.** Owner check on `[id]`. Remove the "return all locations" fallback in `stock-locations` GET and in `taxonomy`. Validate `stock_location_id` in `products` POST and remove its first-location fallback.
4. **Sales channels.** Scope the list and `[id]` GET by the vendor-sales-channel link. Owner check on update/delete. Check the channel id in `sales-channels/[id]/products`.
5. **Shipping profiles and shipping option types.** New links `vendor-shipping-profile` and `vendor-shipping-option-type` in `backend/src/links/`. Scope lists and by-id. Link on create. Make `workflows/create-vendor-product.ts` use and validate the seller's own profile (today it always links the default profile). Update `scripts/fix-shipping-profiles.ts`.
6. **Product tags, types, options.** Scope the lists to the seller's own and add owner checks on by-id. Validate `product_id` on option create. Verify where the tag and type links are written today.
7. **Draft orders.** Owner check on `[id]` GET/DELETE and `[id]/convert`. Validate every id in the create body (customer, variants, region, sales channel, shipping options, promo codes).
8. **Customers** (per D1). Customers who ordered from the seller are readable with limited fields; writes only for customers created by the seller. Bind address deletion to the customer. Validate `remove` ids on customer groups. Stop returning other sellers' group names.
9. **Collections and categories.** Owner check on collection update/delete. Validate the target id in the collection and category products routes.
10. **Inventory.** Validate `location_id` against the seller's locations in: inventory create, location-levels create, location-levels by-id, both batch routes, and reservations. Validate `inventory_item_id` in the variant-attach routes and the inventory-levels route.
11. **Price lists, promotions, campaigns.** Bind batch `delete[]` / `update[].id` price ids to the list. Verify and fix the promotion rule batches. Validate campaign body ids.
12. **Product import.** Record which seller started each import and check it on confirm. Bind `file_key` to the seller. Replace the naive CSV id check with a real CSV parser. Add a `product.created` subscriber that links imported products to the seller. Store import CSVs privately.
13. **Search.** Scope the customer, customer group and inventory queries to the seller's own data. Remove the unfiltered full-table queries.
14. **Notifications and workflow executions.** Scope to the seller's own data with a real filter instead of substring matching on raw JSON.
15. **Platform-owned regions and tax.** Remove seller write access to regions and country tax regions (`regions` POST, `tax-regions` POST and `[id]`). They stay platform-owned (D6). Seller tax arrives in Phase 2.
16. **Smaller fixes.** Validate `service_product_id` / `service_variant_id` in `providers/me/slots`. Rentals ownership on shared orders. Block onboarding edits and re-submit after approval. Make the recurring-availability 403 a 404.
17. **Interim order response.** In the vendor order list and detail, also redact payments, other sellers' fulfilments and extra customer data until Phase 3.
18. **Seller panel.** Call `isRouteAllowed()` so capability flags guard routes, not just the sidebar. Add a client-side 401 redirect.

**Gate:** the coverage check (Phase 0 step 6) passes for every route, plus all cross-seller tests, `tsc`, `typecheck`, `lint`.

### Phase 2: Per-seller commerce setup

1. **Stock location provisioning.** Extend `workflows/create-vendor-stock-location.ts` so a new location also gets a fulfilment set (`createLocationFulfillmentSetWorkflow`), a service zone with geo zones, a fulfilment provider link (for example `manual_manual`), and a sales channel link (`linkSalesChannelsToStockLocationWorkflow`).
2. **Shipping options.** Vendor routes and seller screens to create, edit and delete shipping options in the seller's own location. Ownership via the chain seller -> stock location -> fulfilment set -> service zone -> option, or an explicit link.
3. **Checkout shipping.** Only offer shipping options of sellers whose items are in the cart (Medusa hooks `setShippingOptionsContext` / `setPricingContext`, or a storefront filter). Group choices per seller with one method each, replacing the storefront's keep-the-last-method logic. Make sure cart completion's shipping-profile validation passes.
4. **Seller tax (D4).**
   - Read Medusa 2.19's custom tax provider interface before designing.
   - New seller-owned tax rate model and links.
   - A custom tax provider, registered in `medusa-config.js`, that picks the rates from each line item's seller.
   - Country tax regions stay platform infrastructure.
   - Seller routes and screens for rates.
5. **Backfill.** A script that assigns owners to existing records using the Phase 0 report. Run it as a dry run first.
6. **Seller panel.** Screens for locations, shipping and tax. Add the missing nav links for categories and tax regions (routes exist but are not linked).

**Gate:** a two-seller cart shows correct per-seller shipping choices and tax, and completes.

### Phase 3: Order splitting and payments

1. **Decide payouts (D2).**
2. **Design note** for the parent and child order model, following Medusa's marketplace recipe (group cart items by seller, one child order per seller, a single-seller cart uses the parent as the seller's order). Includes how parent and child are linked.
3. **Checkout workflow.** A custom complete-cart workflow that groups items by seller, creates the children and links each to its seller.
4. **One completion path.** Replace the storefront's choice of endpoint (tickets, rentals, digital, standard) with one workflow that runs the ticket, rental, EOI, digital and appointment steps per child. The storefront currently never calls the appointment or EOI completion routes.
5. **Payment.** The parent keeps the single payment collection. Handle the Stripe partial-capture gap. Record per-child amounts. Add Stripe Connect transfers or the payout ledger per D2.
6. **Adapt everything that assumes one order per cart:**
   - `subscribers/link-vendor-order.ts` and the `order.placed` event (one per child, or a custom event)
   - `subscribers/order-placed.ts` email (parent-aware), `ticket-order-placed.ts`, digital orders (one per child)
   - rentals and EOI, which key on `line_item_id` (line items get new ids on child orders)
   - `order-canceled.ts`, `shipment-created.ts`, `workflows/hooks/validate-order-cancel.ts`
   - company and approval flows, `company-order` link
   - quote flows (draft orders get no seller link and no `order.placed`)
   - restaurant delivery (second order with no payment link)
7. **Storefront.** Confirmation page for a parent with children, the order list, payment details.
8. **Existing orders.** Legacy shared orders keep the Phase 1 redaction and are flagged, not rewritten.
9. **Performance.** The vendor order list loads every linked order and filters in memory; query by link instead.

**Gate:** a multi-seller cart creates N child orders, totals add up, and payment, emails and per-feature records land on the right child.

### Phase 4: Seller fulfilment

1. **Routes** wrapping Medusa's order workflows: create fulfilment, create shipment, cancel fulfilment, mark delivered. Each checks that the order, items, location and shipping option belong to the seller, and requires an explicit shipping option id (Medusa defaults to the first shipping method).
2. **Cancel order, refund and returns** on the seller's own child order. Refunds are per child amount against the parent payment.
3. **Reservations.** Reserve and adjust stock at the seller's own location (the seller location must be linked to the sales channel).
4. **Rentals.** Ownership by child order.
5. **Delivery module.** Replace the hard-coded location `loc_1` in `workflows/delivery/steps/create-fulfillment.ts`.
6. **Seller screens.** Order detail actions: fulfil, ship with tracking, deliver, cancel, refund, return.
7. **Buyer emails** for shipment and delivery.

**Gate:** a seller fulfils only their own child order; attempts on another seller's order return 404.

### Phase 5: Missing features

Each feature gets: a link where needed, guarded `/vendors` routes, client helpers in `sellers/src/lib/data/vendor-client.ts`, UI under `sellers/src/modules/<feature>/` (copy the venues layout), route pages under `app/(panel)/`, sidebar entry plus capability flag, and cross-seller tests.

1. **Enquiries.** Product config, inbox, reply, status. Ownership through the product.
2. **Expressions of interest.** Product config, list, EOI items on orders.
3. **Digital products.** A `create-vendor-digital-product` workflow that links the underlying product to the seller. Scope the uploads.
4. **Restaurants.** New Vendor <-> Restaurant link. Seller routes reusing the restaurant workflows. Menu through product assignment. Deliveries list for the seller's restaurants. Drivers are out of scope.
5. **B2B.** Quotes and approvals scoped to the seller's orders. First give quote draft orders a seller link. Companies stay platform-managed (buyer company admins manage their own staff in the storefront).
6. **Show editing** (the seller panel has create and delete only).
7. **Dashboard metrics.** A stats endpoint and real tiles (the current dashboard is a placeholder).

**Gate:** each feature's negative cross-seller tests pass.

### Phase 6: Hardening and release

1. Re-run the full route audit against the finished code and compare to section 3.
2. Full test, typecheck and lint on backend and `sellers/`.
3. Update `sellers/PRODUCTS.md` and `sellers/README.md` (stale: port, docs on disabled modules, a "how to add a module" section).
4. Rollout order: migrations, backfill, enable.
5. Rollback notes per phase.

---

## 7. Phase 0 results (completed)

Run on a throwaway local Postgres 16 (embedded-postgres), never on a real database.

### 7.1 Runtime checks (`integration-tests/http/probes/phase0-runtime-probe.spec.ts`)

| Question | Result |
|---|---|
| Do deep `/vendors` paths require authentication? | **Yes.** Nine deep paths tested without a token (layouts, variant inventory-levels, price-list batch, show scan, import confirm, taxonomy, customer address, location-levels batch, list) all returned 401. `/vendors/*` is a prefix match. The comments in `middlewares.ts` claiming single-segment matching were wrong and are corrected. |
| Can a seller-minted secret API key reach the admin API? | **Not demonstrated.** A seller can create a `secret` key (201) but its token is never returned by the create, by-id or list routes, so it cannot be used. The real risk is cross-seller read/revoke/delete of any key, including platform keys. Sellers should still not create secret keys. |
| Do feed/broadcast notifications reach other sellers? | **Yes, confirmed.** A feed notification addressed to someone else was returned to seller B. |
| Do the `layouts/*` routes do anything? | **No.** Authenticated GET returns null configurations; the routes are inert. |
| Campaign create body accepting foreign `promotions[]` | Still unverified; checked in Phase 1 step 11. |

### 7.2 Read-only data report (live database, counts only)

| Item | Count |
|---|---|
| Sellers / seller admins | 70 / 70 |
| API keys | 2, both publishable, none linked to a seller (no seller-created secret keys exist) |
| Orders | 15 total, 1 linked to a seller, 0 linked to more than one seller |
| Products | 74 total, 28 linked |
| Inventory items | 127 total, 40 linked |
| Customers | 18 total, 1 linked |
| Price lists / promotions | 3 total, 1 linked / 2 total, 1 linked |
| Product options / types / tags | 104 / 4 / 0 total, none linked |
| Stock locations | 1 total, 0 linked (no seller has created one; the platform's is visible to every seller through the list fallback) |
| Sales channels | 2 total, 0 linked |
| Shipping profiles / options / tax regions / regions | 1 / 2 / 7 / 1, no seller link exists |

Notes: 14 of 15 orders have no seller link (to be investigated in Phase 1: it may be the `link-vendor-order` subscriber failing). The unowned rows for the Phase 2 backfill are small (46 products, 87 inventory items, 17 customers, plus platform configuration).

### 7.3 New finding: a missing migration

The `Vendor` model declares `metadata`, but no migration created the column, so a database built only from migrations could not register a seller (`column "metadata" of relation "vendor" does not exist`). The live database already has the column. Fixed with an idempotent migration (`Migration20261001120000`) and an updated snapshot.

### 7.4 First cross-seller test (stock locations) against the current code

| Test | Result |
|---|---|
| A reads/updates/deletes A's own location | pass |
| A's list contains A's location and not B's | pass |
| A reads B's location | **fails: 200, expected 404** |
| A updates B's location | **fails: 200, expected 404** |
| A deletes B's location | **fails: 200, expected 404** |
| A seller with no locations sees an empty list | **fails: sees the store's locations** |

These four failures prove the hole and become the Phase 1 step 3 acceptance test.

### 7.5 How to run the tests

- `pnpm run test:unit`: database-free guard ratchet and safety check.
- `pnpm run test:integration [-- <path>]`: starts a local embedded Postgres, runs the HTTP specs, and removes it afterwards.

## 8. What this plan does not cover

- Postgres row-level security as a second layer.
- Auditing the admin API, the store routes, the restaurant and driver logins, and the TrustClaw onboarding store.
- Stricter customer visibility (D1 can be tightened later).
- Order splitting for existing legacy orders.

## 9. Files most likely to change

- Backend routes: `backend/src/api/vendors/**`, `backend/src/api/middlewares.ts`, `backend/src/api/vendors/shared/vendor-scope.ts`
- New links: `backend/src/links/` (shipping profile, shipping option type, restaurant, tax rate, others)
- Workflows and subscribers: `backend/src/workflows/**`, `backend/src/subscribers/**`
- Config: `backend/medusa-config.js` (tax provider, test config)
- Seller panel: `sellers/src/lib/data/vendor-client.ts`, `sellers/src/modules/**`, `sellers/src/app/(panel)/**`, `sellers/src/modules/layout/components/sidebar.tsx`, `sellers/src/lib/permissions/feature-access.ts`
- Storefront: `storefront/src/lib/data/cart.ts`, checkout shipping component, order confirmation and list pages
