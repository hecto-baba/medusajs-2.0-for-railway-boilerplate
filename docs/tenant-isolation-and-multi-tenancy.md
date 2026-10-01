# Tenant Isolation and Multi-Tenancy Plan

Status: Phases 0 and 1 complete; Phase 2 code complete, verification and rollout pending (see section 11). Branch: `feature/tenant-isolation` (off `feature/marketplace`).
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
| D2 | Seller payouts: Stripe Connect or a platform-held payout ledger | **Decided: platform-held ledger** (the platform collects the whole payment on the parent order, records what each seller is owed, and pays sellers itself; Stripe Connect can be added later and fed from the ledger) |
| D3 | Is the database in `backend/.env` a development database? | **Open** (needed before Phase 0 step 1 testing) |
| D4 | Seller tax: a seller-owned **native Medusa tax rate** with product and shipping-option rules, not a custom provider (country tax regions stay platform-owned because of the unique-per-country index) | **Decided (Phase 2.4)**: the 2.19 provider interface gets only the item and the rates, with no way to look up a seller, so a provider cannot do it cleanly; native rate rules can |
| D5 | Orders are split into a parent order (holds the payment) plus one child order per seller | **Decided (Phase 3)**: done after placement by a subscriber rather than inside a custom complete-cart workflow, so every completion path is covered. See section 12 |
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

### Phase 1: Isolate everything that exists today (COMPLETE, see section 10)

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

## 10. Phase 1 results (completed)

Gate: **23 of 23 HTTP spec files and 193 of 193 HTTP tests pass**, plus 12 database-free tests (the route guard ratchet, a safety check, and 8 tests of the CSV reader). Backend typecheck: 0 errors. Seller panel typecheck and lint: clean. Every fix was written test first: the new test failed on the old code, then passed on the fix, then was committed (one commit per step, `feature/tenant-isolation`).

### 10.1 What was closed

| Step | Closed |
|---|---|
| 1 | API keys: ownership on every by-id route; sellers create publishable keys only |
| 2 | Team members: only your own team |
| 3 | Stock locations: own plus shared platform locations, never another seller's |
| 4 | Sales channels: same rule |
| 5 | Shipping profiles and option types: new vendor links; a product uses a profile the seller may use |
| 6 | Product tags, types, options; types and tags named in product bodies |
| 7 | Draft orders, including the chain where naming a stranger's customer made it "yours" |
| 8 | Customers (decision D1), addresses, groups |
| 9 | Collections; internal categories hidden; collections and categories named in products |
| 10 | Inventory: every location, inventory item and line item id in a request |
| 11 | Price list prices, promotion rules (confirmed exploitable), customer groups on price lists |
| 12 | Product imports: every CSV reference, import ownership, linking imported products |
| 13 | Search: no longer loads every customer, group, collection, category and inventory item |
| 14 | Notifications and workflow executions |
| 15 | Regions and tax regions: platform-owned, read-only (D6) |
| 16 | Appointment slots, rentals on shared orders, onboarding after approval, recurring availability |
| 17 | Orders that contain other sellers' items: whole-order figures withheld (interim) |
| 18 | Seller panel: capability flags now guard routes; expired sessions go to /login |

The route guard ratchet backlog went from 24 unguarded by-id routes to 1 (an inert one).

### 10.2 Findings beyond the original audit

- Any seller could read EVERY seller's notifications, not only broadcast ones: the `feed` filter matched all of them.
- **Medusa allows only one seller per order link** ("Cannot create multiple links between marketplace and order"). The `link-vendor-order` subscriber therefore cannot record a multi-seller cart, which is likely why most live orders have no seller link. One order per seller (Phase 3) is required, not optional.
- A new database could not register a seller: the `vendor.metadata` column had no migration (fixed in Phase 0).
- Existing bugs fixed along the way: `POST /vendors/customers/:id/customer-groups` returned 500 for every request (no validator registered); creating a price list without a description returned 500; the code read a seller's collections through a field that does not exist, so their own empty collections never listed; the workflow execution route's database pool had no error handler.
- Confirming an import released the importer for ANY transaction id, and imported products were never linked to the seller.
- The product import CSV check read only the "Product Id" column with line splitting; Medusa's importer also acts on variant ids, types, collections, categories, tags (by value), sales channels, shipping profiles and option ids.

### 10.3 Deploy notes (run before or with this release)

1. `medusa db:migrate` creates three things: the `vendor.metadata` column (idempotent, already present on the live database), the `vendor_product_import` table, and the link tables `vendor-shipping-profile` and `vendor-shipping-option-type`.
2. Existing shipping profiles, option types, tax regions and regions have no owner and are shared platform resources: sellers can see and use them, not edit or delete them. No backfill is needed for that.

### 10.4 Behaviour changes sellers will notice

- Regions and tax regions can no longer be created, changed or deleted by sellers (403). The Settings screens for them will show an error until Phase 2 replaces them.
- The platform's stock location and sales channel stay visible and usable (read-only) so existing sellers keep working; they are retired from view in Phase 2.
- A customer who only ordered from a seller is shown without addresses or metadata and cannot be edited by that seller.
- On an order that also holds other sellers' items, the seller no longer sees the whole order's payment, shipping and fulfilment.
- Approved sellers can no longer edit onboarding answers.
- Internal categories are no longer listed to sellers.
- Notifications: sellers get only those addressed to them.

### 10.5 Known limits (not closed by Phase 1)

- Uploaded files are not tied to a seller (only import CSVs are, by their file key).
- `/vendors/layouts/*` is inert (no behaviour); left as is.
- The admin API, store routes and the restaurant/driver logins were not audited.
- Mixed orders stay mixed until Phase 3; the redaction in step 17 is interim.
- No Postgres row-level security: isolation is enforced in code and by the tests above.
- **Not deployed yet.** Phase 1 is finished and tested in code, but nothing is live until the release is deployed and `medusa db:migrate` has been run. Until then the live database lacks the new tables and the fixes are not in effect:
  - the `vendor_product_import` table (product imports will fail without it);
  - the `vendor.metadata` column (idempotent; already present on the live database);
  - the link tables for shipping profiles (`vendor-shipping-profile`) and shipping option types (`vendor-shipping-option-type`).
- Existing shipping profiles, option types, regions and tax regions have no owner. They stay shared platform resources (visible and usable by sellers, not editable) until Phase 2 decides who owns them. No backfill is done in Phase 1.

### 10.6 Running the tests

- `pnpm run test:unit`: database-free ratchet, safety check and CSV reader tests.
- `pnpm run test:integration`: starts a local embedded Postgres, runs every HTTP spec in its own process (one long-lived process runs out of memory after about fifteen), prints a summary, and removes the database.
- `pnpm run test:integration -- <path>`: one spec.
- Runner behaviour worth knowing: data created inside a test is rolled back after it (only `beforeAll` data persists), setup in a second describe block is lost, and an import left waiting for confirmation blocks teardown, so tests must abandon what they start.

## 11. Phase 2 progress

Each step: test first, then the fix, one commit, listed below with its test file (under `backend/integration-tests/http/phase2/`).

| Step | Done | What it does | Test |
|---|---|---|---|
| 1 | yes | A new seller location gets a shipping fulfilment set, a service zone for its country, the manual provider link and the default sales channel link | stock-location-provisioning (4) |
| 2 | yes | `/vendors/shipping-options` list, create, read, update, delete. Ownership by chain seller -> location -> set -> zone -> option (no new link). Only the seller's own profile, own-or-platform option type, provider linked to the location, flat price, fixed storefront rules | shipping-options (8) |
| 3 | yes | Checkout per seller: `GET /store/carts/:id/seller-shipping-options` returns one group per shipping profile with only the options that ship those items; an `addShippingMethodToCart` hook refuses an option that ships nothing in the cart; the storefront shows one choice per seller | cart-shipping (3) |
| 4 | yes | Seller tax: `/vendors/tax-rates` (own rates only), a new vendor <-> tax rate link, and rules that keep each rate attached to the seller's products and shipping options | seller-tax (5) |
| 5 | yes (script written and tested, **not yet run on any real database**) | `src/scripts/phase2-backfill.ts`: dry run by default. Per seller: an own shipping profile if missing; products on a shared platform profile move to it; locations without a fulfilment set get the step 1 setup. Reports, never changes, records with no provable owner (unowned products, inventory items, customers; sellers with products but no location) | backfill (1, covers dry run, apply, second run) |
| 6 | yes (typecheck and lint only, not run in a browser) | Settings > Shipping Options and My Tax Rates screens; Categories nav link; stock location list returns service zones | none |

### 11.1 Findings from Phase 2

- Medusa keeps ONE shipping method per shipping profile (adding a method removes the cart's methods for the same profile) and does not filter the option list by the items in the cart. That is the real cause of the storefront "keeps the last choice" behaviour. The fix is structural: each seller ships under their own profile, so two sellers never collide.
- The 2.19 tax provider receives only the item (id, product id, type, quantity, price) and the rates found for it. It has no way to find the seller, so seller tax is done with native rate rules (D4 above).
- A tax rate requires a `code`; the seller route defaults it to the name.
- A seller location's fulfilment set stays behind when the location is deleted (the link is removed, the set is not), as in Medusa admin.

### 11.2 What this means for existing data (to be handled by step 5)

- Existing seller products usually sit on a shared platform profile, so they form one group at checkout served by platform options. A seller's own shipping options are only offered for products on the seller's own profile, so step 5 must move each seller's products onto an own profile (creating one when the seller has none).
- Existing sellers have no fulfilment set on their location (step 1 only covers new locations), so step 5 must provision it.
- Tax regions must have a platform default rate for seller rates to override.

### 11.3 Running the backfill (not done yet)

1. Back up the database.
2. Dry run: `npx medusa exec ./src/scripts/phase2-backfill.ts` and read the counts.
3. Apply: `npx medusa exec ./src/scripts/phase2-backfill.ts apply`. Safe to run again.
4. The "needs attention" list is for a person to decide: unowned products, inventory items and customers (platform-owned or assigned to a seller), and sellers who have products but no stock location.

### 11.4 Phase 2 gate status

- Automated: **28 of 28 HTTP spec files pass** (23 from Phase 1 plus 5 for Phase 2), 12 database-free tests pass, backend and seller panel and storefront typechecks clean.
- **Not yet covered, so the gate is not fully met:**
  1. A two-seller cart is not yet completed into an order in a test (the gate says "and completes"). Shipping choices, one method per seller, and per-seller tax are proven on the cart.
  2. The new seller screens and the storefront checkout have not been run in a browser.
  3. The backfill has not run on any real database.
  4. Nothing is deployed to QA; `medusa db:migrate` is needed for the new vendor-tax-rate link table (and the Phase 1 tables).
- Decisions needed from the owner: what to do with the unowned products, inventory items and customers the backfill reports; whether a seller with no shipping options of their own should fall back to platform options at checkout (today they see "no delivery options" unless their products stay on a platform profile).

### 11.5 Pending in Phase 2 (checklist)

Code for steps 1 to 6 is written and committed. These items remain before Phase 2 is closed.

**A. Finish the gate (no outside access needed)**
- [ ] Test: a two-seller cart completes into an order (needs a payment provider set up in the test). The gate reads "shows correct per-seller shipping choices and tax, and completes".
- [ ] Re-run the full suite after that test is added.

**B. Verification that needs a running environment**
- [ ] Run the seller screens in a browser: Settings > Shipping Options and My Tax Rates (create, edit, delete), and the Categories link.
- [ ] Run the storefront checkout in a browser with a two-seller cart (one choice per seller, Continue disabled until each is chosen, no-options message).
- [ ] Check what a seller with no shipping options of their own sees at checkout.

**C. Deploy to QA (needs owner action)**
- [ ] Owner runs `railway login`; confirm which branch QA deploys from.
- [ ] Push `feature/tenant-isolation` (owner confirms the push).
- [ ] `medusa db:migrate` creates: `vendor_product_import` table, `vendor.metadata` column (idempotent), link tables vendor-shipping-profile, vendor-shipping-option-type, vendor-tax-rate. Confirm the tables exist.
- [ ] Smoke test with a real seller account.

**D. Backfill on real data (needs owner action)**
- [ ] Database backup first.
- [ ] Dry run `npx medusa exec ./src/scripts/phase2-backfill.ts`, read the counts.
- [ ] Apply with `apply`, then run it again to confirm nothing is left.
- [ ] Review the "needs attention" list.

**E. Decisions for the owner**
- [ ] Unowned records the backfill only reports (earlier live report: 46 products, 87 inventory items, 17 customers): platform-owned, or assign to a seller.
- [ ] Should a seller with no shipping options of their own fall back to platform options at checkout? Today they see "no delivery options" unless their products stay on a shared platform profile.
- [ ] The platform stock location and sales channel are still visible read-only to sellers; the plan said they would be retired from view in Phase 2. Retire them now or later?

**F. Known limits to carry forward**
- A deleted location leaves its fulfilment set behind (link removed, set kept), as in Medusa admin.
- Seller tax covers products and shipping options, country regions only; province-level seller rates are not supported.
- A seller's shipping option must use the seller's own profile; two sellers on a shared profile would overwrite each other's choice (Medusa keeps one method per profile).
- Shipping options are flat-price only; calculated pricing is not offered to sellers.
- Admin-side screens and routes for these new resources were not changed or audited.

## 12. Phase 3: order splitting and payments

### 12.1 Design note (step 2)

**Model.** The cart completes into ONE parent order. It holds the buyer's payment, shipping choices, tickets, rentals, emails: it is the order the buyer sees. For each seller whose products are in it, a CHILD order is created holding only that seller's items and the shipping methods that ship them. Rules:

| Case | Result |
|---|---|
| All items belong to one seller | The parent is that seller's order and is linked to them. Nothing is split |
| Items of several sellers, or a seller's items next to platform items | One child per seller, each linked to its seller. The parent is linked to no seller, so no seller can open the whole order |
| No seller item at all | Nothing to do |

**Why a subscriber, not a custom complete-cart workflow.** Every completion path (core, quote acceptance, draft order conversion) announces `order.placed`. One subscriber covers all of them; a custom workflow would cover only the paths that call it.

**Linking parent and child.** A table `vendor_order_split` (marketplace module): parent order id, child order id, seller, currency, items, shipping, tax and total, payout status. It doubles as the payout ledger. A unique index on (parent, seller) makes the split idempotent: a re-run skips sellers that already have a child, so a failure half-way is repaired by running it again. A child also carries `metadata.split_child`, `parent_order_id`, `vendor_id` and `buyer_customer_id`; each copied line item carries `metadata.parent_line_item_id`.

**Children have no customer id.** Medusa lists a customer's orders by `customer_id`, so a child with one would appear in the buyer's order history next to the order they paid for. The buyer is kept in metadata and the seller screens fill the customer from the shipping address (customer visibility rule D1 reads the metadata too).

**Payment.** The parent keeps the single payment collection. A child has none; seller screens show only the parent's payment STATUS, never its amounts. Because the platform collects everything, Medusa's Stripe partial-capture gap does not apply.

**Ledger (D2).** One row per child: items, shipping, tax and total in the order currency, status owed -> paid (admin, with a bank reference) or void. Cancelling a child voids its row; cancelling the parent cancels every child and voids their rows. Paid rows are final.

**What stays on the parent.** Emails (one confirmation, from the parent), tickets, digital orders, appointments, rentals and expressions of interest are written against the parent order and its line items. The parent is the buyer's record, so those flows needed no change. Where a seller works from the child, lookups translate through `parent_line_item_id` (rentals).

### 12.2 The nine steps

| # | Step | Status |
|---|---|---|
| 1 | Decide payouts (D2) | Done: platform ledger |
| 2 | Design note | Done (12.1) |
| 3 | Split at checkout | Done: `lib/split-order.ts`, run by the `order.placed` subscriber; replaces the old link-vendor-order logic, which tried to link several sellers to one order and could not |
| 4 | One completion path | Done and tested: `complete-cart-marketplace` workflow and `POST /store/carts/:id/complete-all` run core completion once, then tickets, rentals, appointments, expressions of interest and digital products for whatever the cart holds. The storefront now calls only this. Old routes remain. See 12.3 |
| 5 | Payment and payouts | Done: ledger table, `GET /vendors/payouts` (own entries and totals), `GET /admin/vendor-payouts`, `POST /admin/vendor-payouts/:id` (mark paid or void). No admin screen yet |
| 6 | Everything that assumed one order per cart | Done as listed in 12.4 |
| 7 | Storefront | Done: `GET /store/orders/:id/seller-orders`; a "Shipped by" block on the confirmation page and the account order page |
| 8 | Existing orders | Done: legacy shared orders keep the Phase 1 redaction and now carry `is_mixed`; the seller screen shows a note. Not rewritten |
| 9 | Performance | Done: the seller order list filters, sorts and pages in the database and loads full order details only for the page. Free-text search, payment and fulfilment status and sorting by total still narrow in memory, over light rows |

### 12.3 Tested and not tested

Tested in `integration-tests/http/phase3/order-split.spec.ts` (a real two-seller cart completed with payment through `complete-all`):
- one child per seller with only their items and shipping, parent linked to no seller
- each seller sees their own child and never the other's; 404 on the parent
- ledger rows add up to the parent order (items, shipping, tax, total)
- re-running the split creates nothing
- a one-seller order (placed through core completion) is not split
- seller ledger scoping and totals; admin settlement; settled entries are final
- cancelling the parent cancels the children and voids the ledger

Also tested (`complete-all-features.spec.ts`, `complete-all-bookings.spec.ts`, `quote-accept.spec.ts`):
- one cart with a standard item, a rental, an expression of interest and a digital product completes through `complete-all`; the rental, EOI and digital order are recorded once, and completing again books nothing twice
- a one-seller order with a rental is not split: the security deposit (a line with no product) stays with the seller. **Found while writing this test:** the splitter first treated the deposit as a platform item and would have split every one-seller rental order; deposits now follow the seller of their rental group
- a mixed cart splits, the seller's order holds the rental AND its deposit, the other seller's holds neither
- the seller finds the rental from their child order (404 for the other seller); shipping the child order activates the rental booked on the parent; cancelling the child cancels the rental and voids the ledger entry
- a cart with a ticket and an appointment next to another seller's product: the ticket purchase and the appointment attendee are recorded on the order, and the split gives the seller both items
- accepting a quote announces `order.placed` and each seller gets their own order (before acceptance, none)

**Not tested in integration:** the storefront pages (typechecked only), the order list's in-memory path with free-text search plus payment status filters on split orders, and the digital order email (no email provider in the test setup).

### 12.4 Step 6 in detail

| Item | Outcome |
|---|---|
| `link-vendor-order` subscriber and `order.placed` | Replaced by the splitter (one parent event; children are created through `order.created`, so nothing fires twice) |
| Buyer confirmation email (`order-placed`) | Unchanged: sent once, from the parent, listing everything |
| Tickets (`ticket-order-placed`) | Unchanged: tickets belong to the parent |
| Digital orders | Unchanged: created and linked on the parent |
| Rentals | Seller order screens and rental ownership now find rentals through the parent (`rentals/helpers.ts`, `orders/[id]/rentals`); shipment activation and cancellation map child line items to the parent's through `parent_line_item_id` |
| EOI | Written against the parent; the seller EOI screens are Phase 5 |
| `order-canceled` | Rewritten: cascades parent -> children, voids ledger entries, cancels rentals by either id scheme |
| `shipment-created` | Maps child line items to the parent's for rental activation |
| Company and approval flows | Operate on the cart and the parent order, which the buyer owns; unchanged by design |
| Quotes | Accepting a quote now announces `order.placed` for the order, so the buyer is confirmed and the seller gets it; before, nothing was emitted |
| Vendor draft-order conversion | Core already emits `order.placed`, so it now goes through the splitter |
| Restaurant delivery | Its second order is now marked `delivery_order` in metadata. It still has no payment and is not linked to a seller; restaurant sellers get their deliveries in Phase 5 |

### 12.5 Deploy notes

- `medusa db:migrate` creates the `vendor_order_split` table (migration 20261001140000) and adds the missing `quote.metadata` column (20261001150000, idempotent).
- Orders placed BEFORE this release are not split; they keep the Phase 1 handling.
- The storefront must be deployed together with the backend: it now calls `/store/carts/:id/complete-all`.

### 12.6 Found and fixed on the way

- The `quote` table had no `metadata` column on a freshly migrated database (the model has one, no migration created it; it existed only where a hand-run script had added it), so every quote insert failed on any new environment. Migration 20261001150000 adds it (idempotent).

### 12.7 Known gaps carried forward

- No admin screen for the payout ledger (API only); no seller screen for earnings (API only).
- Refunds and returns against a child order, and seller fulfilment, are Phase 4.
- `GET /store/orders/:id` and the new `/seller-orders` take an order id with no customer check (the existing route already worked this way, for guest confirmation pages).
- Ledger amounts are decimal floats in the order currency.
- A child order that cannot be cancelled (already fulfilled) when its parent is cancelled is logged and left for a person.
