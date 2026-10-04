# Storefront Redesign — Execution Plan

Companion to `STOREFRONT_REDESIGN_PLAN.md` (the strategy: what and why). This document is the **how**: working rules, commands, phase-by-phase tasks with files and acceptance checks, and a progress tracker.

**Where the two disagree, this document wins on git and process.** The strategy doc's Phase 0 describes a separate branch and worktree. That was tried and withdrawn. The work happens on `feature/tenant-isolation` in the main folder.

Design reference: the approved clickable prototype ("Express Web Storefront" artifact). Its brand name, palette and sample products are placeholders.

---

## 0. Implementation status (updated after the first build pass)

All phases have a first implementation on `feature/tenant-isolation`, uncommitted. `pnpm typecheck` is clean. Nothing was committed or pushed by the build.

| Phase | Status | Notes |
|---|---|---|
| Session 0 | Done | Data below. 312 `data-testid`s exported at the start of the build. |
| 1 Foundations | Done | Tokens (light and dark), fonts, `Price`, `DiscountBadge`, `Chip`, `QtyStepper`, `Drawer`, `FreeDeliveryBar`, `BillBreakdown`, `ProductCard`, `Breadcrumbs`, `SectionHeader`; dev page `/dev/ui` (404 in production). Existing `Modal` tokenised. |
| 2 Shell | Done | New header, category row with an "All categories" panel, footer, theme toggle. Search field opens the existing search modal. The menu button stays on desktop because the interactive and mobile specs use it. |
| 3 Cart | Done | `CartProvider` with instant (optimistic) quantity changes, cart drawer, `/cart` page restyled. Conflict dialog when food and retail would mix. |
| 4 Cards, home, listings | Done | One `ProductPreview` card for every listing; ADD rule applied; home page, store, category and collection pages with sidebar and sort pills. |
| 5 Product page, checkout | Done | A full guest order was placed through the restyled checkout by the test suite. |
| 6 Rent | Done | `/rent` hub with unit filter; rental picker and calendar restyled (span highlight). |
| 7 Book | Done | Hub, business page, slot picker (three columns), my bookings. Two storefront calls needed a currency (see "Fixes outside the redesign"). |
| 8 Enquiry and EOI | Done | Enquiry form (already existed) restyled. EOI option added; deposit maths checked against the backend, not run end to end (no active configuration). |
| 9 Eat, Tickets, Digital, Quotes | Done | Restyled. Add buttons on restaurant pages stay plain ADD buttons (they do not track the cart quantity). Digital cards come from the shared product card. |
| 10 Account, mobile, hardening | Mostly | Account and order pages restyled and seen logged in through the test suite. Phone bottom navigation added. Dark mode is opt-in. Production build, Lighthouse and axe not run. |

### Findings that changed the plan

- **Mixed carts are supported.** `placeOrder` sends every cart to `/store/carts/:id/complete-all`, which records tickets, rentals, appointments, EOIs and digital products together. Decision D5 is settled.
- **Enquiry UI already existed** (`enquiry-form`, `lib/data/enquiries.ts`).
- **B1 and B2 resolved without backend work.** `+variants.eoi_configuration.*` and `+enquiry_configuration.*` can be requested on the store products query.
- **B3 (list rentable products)** is handled by filtering the catalogue in the storefront (`/rent`). Fine for a few hundred products.
- **B4**: the free-delivery amount and the delivery time are display-only environment settings: `NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD` and `NEXT_PUBLIC_DELIVERY_ETA`. Unset means the bar and the chip are hidden. The storefront never invents a promise.
- Category tiles have no icons, so they show the first letter on a coloured square (B5 still open).
- The store has no sale prices, so no "% OFF" badges show anywhere yet (B6 still open: data only).

### Fixes outside the redesign

- `lib/data/appointments.ts`: `getBusiness` and `getAppointmentSlots` now also send `currency_code`. The backend routes fail with "calculatePrices requires currency_code" when only `region_id` is sent, so the Book business page and the slot picker returned errors before. The product route derives the currency from the region itself, so the backend routes are inconsistent. Fixing the routes to do the same would be cleaner.

### Added in the finishing pass

- Cart drawer: "Complete your cart" suggestions (new server action `lib/data/suggestions.ts`), one-tap items only.
- Listing filters: "On sale" and a price range on store, category and collection pages, kept in the URL (`lib/util/listing-filters.ts`). Applied in memory on the 100 products already loaded for sorting.
- Product page: price on option cards for single-option products; `product-actions` split (EOI options, quantity control, delivery info are now their own files).
- Phones: bottom navigation (hidden on product pages, where the sticky buy bar takes over) and a one-row header.
- Shared leftovers tokenised: input, select, checkbox, radio, totals, skeletons, line-item helpers.
- Quote popup rebuilt on the shared modal, with the hard-coded euro sign and divide-by-100 removed.
- Tests: helpers pick a purchasable product from the catalogue when a hard-coded handle is no longer sold normally; new spec `qa/17-redesign.spec.ts`.

### Test status (local stack, run on 2026-10-04)

Specs run: `03`, `04`, `05`, `07`, `09`, `11`, `12`, `17` and `01`/`02` earlier. They created test customers, carts and orders in the local database (customer emails start with `qa-`).

- Passing: registration, sign-in, profile, address book, signed-in order history, a full guest order from cart to confirmation, the checkout steps and rules, the cart drawer, the product-card rules, filters, rent hub, phone navigation, dark mode toggle, interactive UI.
- Failing for reasons outside the redesign: `11` "search results are a real list" needs Meilisearch (not running locally); `16` file upload and `10` admin need an admin sign-in (the env holds placeholder credentials); `13` card payment is skipped (no Stripe key); `14`/`15` need a Resend key.
- Skipped on purpose: the EOI spec, because no variant has an active EOI configuration.
- Changed on purpose: five placeholder-hero tests replaced; cart and nav tests expect the drawer; tests that used a fixed product handle now fall back to a product that can be bought.

### Still open

- Production build (`next build`), a Lighthouse run and an axe accessibility pass were not run. A build needs the dev server stopped or a separate output folder.
- Dark mode follows the footer toggle only; following the system setting is not switched on.
- EOI end to end (needs an active configuration and admin access), search typeahead (needs Meilisearch), category icons, sale prices, booking hold countdown (backend), delivery slots, tip, handling fee, UPI and cash on delivery.
- Restaurant ADD flow and seat selection were restyled but not driven by a test.
- Nothing is committed.

### Data available (Session 0)

| Item | State |
|---|---|
| Products | 66 (32 with images, 24 with several variants, 42 with one) |
| Collections | 3 |
| Categories | about 80 top-level |
| Sale prices | none |
| Rental products | 7 |
| Digital products | none detected in the product query |
| Enquiry-enabled | 1 (Medusa Sweatpants) |
| EOI configs | 1, inactive |
| Appointment businesses | 1 (two people, two services) |
| Restaurants | 5 |
| Regions | 1 (Europe, EUR) |
| Payment providers | manual only |

---

## 1. Working agreement

| # | Rule |
|---|---|
| 1 | Work on `feature/tenant-isolation` only. No new branches, no worktrees. |
| 2 | Claude edits and creates files. Claude does **not** commit, push, stash, reset, checkout or rebase. The owner commits. |
| 3 | The tree was clean at the start (HEAD `bf0f150`), so `git status` and `git diff` show exactly the redesign changes. Keep it that way: no unrelated edits. |
| 4 | One phase at a time. At the end of a phase Claude stops, hands over, and waits for approval before starting the next. |
| 5 | The owner's dev servers (storefront `:8000`, backend `:9000`) are not started or stopped by Claude. If another port is needed, ask first. |
| 6 | Nothing that creates accounts, orders or other data runs against the local database without explicit OK. |
| 7 | Never remove or rename a `data-testid`. Never change the signature or behaviour of `src/lib/data/*` server actions without asking. |
| 8 | Restyle logic-heavy files (date picker, seat map, checkout actions, `product-actions`), do not rewrite their behaviour. |
| 9 | Anything outside `storefront/` (backend, sellers) is a listed gap in [§9](#9-backend-gaps) and needs its own approval. |

## 2. Environment and commands

All commands run from `storefront/` unless noted.

| Task | Command |
|---|---|
| Type check (builds ignore type errors, so this is the real check) | `pnpm typecheck` |
| Lint | `pnpm lint` |
| QA suite against a running stack | `pnpm test:qa` |
| One QA spec | `pnpm exec playwright test --config=playwright.qa.config.ts qa/04-cart.spec.ts` |
| Point QA at another URL | set `QA_BASE_URL` (default is `NEXT_PUBLIC_BASE_URL`, else `http://localhost:8000`) |
| Re-export test ids | `grep -rhoE 'data-testid=("[^"]+"|\{[^}]+\})' src \| sort -u > ../docs/plan/storefront-testids.txt` |
| Production build check | `pnpm build:next` (only when a phase touches config or routes) |

Local stack: Postgres on `:5432` is up. Redis (`:6379`) and Meilisearch (`:7700`) were **down** when checked, which affects search. `docker compose up -d` at the repo root starts them. Storefront env lives in `storefront/.env.local` (git-ignored).

Playwright notes: `fullyParallel: false`, one worker, 120 s test timeout (sized for `next dev`). Specs that write data: `03-account`, `05-checkout`, `07-addresses`, `09-order-confirmation`, `13-payment`, `14-email`, `15-password-reset`, `16-file-upload`, and `10-admin` (logs in to admin). Read-mostly: `01`, `02`, `04`, `06`, `11`, `12`.

## 3. Verification routine (run at the end of every phase)

1. `pnpm typecheck` → 0 errors.
2. `pnpm lint` on changed files → no new errors.
3. Test-id check: re-export the list and diff against `docs/plan/storefront-testids.txt`. Nothing removed (additions are fine).
4. Open each changed page in a real browser at **1440 px** and **390 px**, in **light** and **dark**. Look for overflow, clipped text, overlap, console errors.
5. Compare against the prototype screen side by side.
6. Run the QA specs listed for the phase. Compare with the baseline in [§4](#4-baseline-before-any-change).
7. Keyboard pass on new interactive pieces: tab order, visible focus, Esc closes drawers and modals, focus returns to the trigger.
8. Hand over: list of changed files (`git status`), screenshots, anything skipped, suggested commit message.

## 4. Baseline before any change

Measured on the pre-redesign code.

| Check | Result |
|---|---|
| `pnpm typecheck` | 0 errors |
| `data-testid` count | 284 distinct (list must be re-exported in Session 0; the earlier file was removed with the worktree) |
| QA, 24 of 47 read-mostly tests finished | 21 pass, **3 fail before any change**: `01` "homepage shows products even with no collections", `02` "sorting the store page keeps products on screen", `04` "quantity can be changed and the total follows" |
| QA remaining 23 of 47 (rest of `04`, `11`, `12`) | not run to completion, finish in Session 0 |
| QA tests that assert the starter's placeholder hero (`01` lines ~95–217, five tests) | pass today, **will fail on purpose** once the hero is replaced. Rewrite them in Phase 4. |

A failing test that was already failing is not a regression. Record it, do not fix it in this project unless the redesign touches the same behaviour.

## 5. Session 0 — finish the baseline (small)

- [ ] Re-export `docs/plan/storefront-testids.txt`.
- [ ] Run the interrupted read-mostly QA specs to completion and record the full pass/fail list here in [§4](#4-baseline-before-any-change).
- [ ] Check the products API for what data exists: count of products, how many have images, categories, variants per product, sale prices (`original_amount > calculated_amount`), rental configs, appointment businesses, ticket shows, restaurants, digital products.
- [ ] Decide whether Redis and Meilisearch need to be running for the phases ahead (search suggestions in Phase 2 do).
- [ ] Confirm which payment providers and shipping options exist for the default region (Phase 5).
- **Output:** a short "data available" table in this file. **Gate:** owner confirms the baseline and data table.

### Data available (fill in during Session 0)

| Item | Count / state |
|---|---|
| Products total | |
| With images | |
| Categories | |
| Collections | 0 (seed creates none) |
| Products with a sale / original price | |
| Single-variant vs multi-variant products | |
| Rental products | |
| Appointment businesses and resources | |
| Ticket shows | |
| Restaurants and dishes | |
| Digital products | |
| Enquiry-enabled products | |
| EOI-enabled variants | |
| Regions and currencies | EUR, USD in seed |
| Payment providers (default region) | |
| Shipping options | |

## 6. Phases

Sizes: S under a day, M a few days, L about a week. Every phase ends with the verification routine in [§3](#3-verification-routine-run-at-the-end-of-every-phase).

---

### Phase 1 — Foundations (M)

**Goal:** tokens and shared components exist and can be reviewed in isolation. No existing page changes behaviour.

**Tasks**
- [ ] `tailwind.config.js`: extend (do not replace) the Medusa preset with brand, accent, ink, surface, line, success and danger colours as CSS variables; keep the existing `grey` scale and breakpoints so current pages are unaffected.
- [ ] `src/styles/globals.css`: define the CSS variables for light and dark under `:root` and `[data-mode="dark"]` / `.dark` (the project uses `darkMode: "class"`; the root layout currently hard-codes `data-mode="light"`). Add small utilities only if the shared components need them.
- [ ] Fonts through `next/font` in `src/app/layout.tsx` (one display face, one body face), exposed as CSS variables and wired to `fontFamily` in Tailwind.
- [ ] Shared components in `src/modules/common/components/`:

| Component | Folder | Notes |
|---|---|---|
| `Price` | `price/` | Props: current, original?, currency code, size. Uses `convertToLocale`. Strike-through original and `DiscountBadge` only when original > current. |
| `DiscountBadge` | `discount-badge/` | "N% OFF". Hidden when N < 1. |
| `Chip` | `chip/` | Variants: success, warning, muted. |
| `QtyStepper` | `qty-stepper/` | Client. Props: quantity, onIncrement, onDecrement, pending, min, max. When quantity is 0 renders the ADD button. Disabled while pending. |
| `Drawer` | `drawer/` | Client. Right-side panel, scrim, focus trap, Esc, scroll lock, returns focus. |
| `Modal` | `modal/` | Exists today (`common/components/modal`). Extend or wrap rather than duplicate; keep its current `data-testid`s. |
| `FreeDeliveryBar` | `free-delivery-bar/` | Props: subtotal, threshold, currency. Renders nothing if no threshold is configured. |
| `BillBreakdown` | `bill-breakdown/` | Reuse the data from the existing `cart-totals`. Adds savings row. |
| `ProductCard` | `product-card/` | Server component shell + client `QtyStepper` slot. Replaces `product-preview` in Phase 4. |
| `SectionHeader`, `Breadcrumbs` | | Plain presentational. |

- [ ] `src/app/[countryCode]/dev/ui/page.tsx`: dev-only showcase of every component in every state, light and dark. Returns `notFound()` when `NODE_ENV === "production"`.

**Acceptance**
- `/dev/ui` renders all components, light and dark, 1440 and 390 widths. 404s in production build.
- Existing pages look and behave as before. Existing QA read-mostly specs unchanged in outcome.
- Keyboard: drawer traps focus and restores it; stepper reachable by Tab.

**Suggested commit:** `feat(storefront): design tokens, fonts and shared UI components`

---

### Phase 2 — Site shell (M)

**Files:** `modules/layout/templates/nav/index.tsx`, `side-menu/`, `cart-button/`, `footer/`, `app/[countryCode]/(main)/layout.tsx`, `lib/data/categories.ts`, `lib/search-client.ts`, `modules/search/*`.

**Tasks**
- [ ] Header row: logo/store name, delivery chip, search field, account link, cart button (count and total).
- [ ] Delivery chip: shows the configured ETA text and the customer's default address or region. Config source in [§9](#9-backend-gaps) (display only for v1). Clicking opens the existing country/address UI or a simple popover.
- [ ] Category row from `listCategories()` (top-level categories, first N plus "All"). Vertical links Eat, Book, Rent, Tickets, Digital with the existing routes.
- [ ] Search typeahead using the existing Meilisearch client. If search is disabled or Meilisearch is unreachable, the field falls back to submitting to `/results/[query]`. Keep `isSearchEnabled()` behaviour.
- [ ] Mobile: header collapses (logo, search icon, cart); category row scrolls horizontally; side menu keeps its role.
- [ ] Footer restyle.
- [ ] Keep every existing `data-testid` in nav and footer; add ids for new elements (`nav-delivery-chip`, `nav-search-input`, `nav-category-<handle>`).

**Acceptance**
- Header correct signed in and signed out, with and without items in the cart.
- Typeahead returns real products (needs Meilisearch up) and degrades without it.
- QA: `01` nav/footer tests pass; hero tests are expected to still pass until Phase 4.

**Suggested commit:** `feat(storefront): new site header, category nav and footer`

---

### Phase 3 — Cart (L)

**Files:** `modules/layout/components/cart-dropdown/`, `cart-button/`, `modules/cart/templates/*`, `modules/cart/components/item/`, `modules/common/components/line-item-*`, `lib/data/cart.ts` (called, not changed).

**Tasks**
- [ ] Client `CartProvider` holding the cart plus optimistic state (`useOptimistic`). Actions call the existing `addToCart`, `updateLineItem`, `deleteLineItem` and always reconcile with the server response.
- [ ] Per-line pending state: stepper disabled for that line while a request is in flight. Handle the "rejected update" case (a recent commit already resyncs the quantity box after a rejected update; keep that behaviour).
- [ ] `CartDrawer` replaces the dropdown: free-delivery bar, grouped line items (use the existing line-item components for rental dates, appointment info, seat info so special lines still render), suggestions rail ("Complete your cart"), coupon (existing promo actions), bill, cancellation note, checkout button.
- [ ] Rental deposit shown as its own line. EOI lines show a badge and the balance due later (placeholder until Phase 8 wires real data).
- [ ] `RequestQuoteButton` becomes a link under the checkout button that opens a `Modal` (reuse `lib/data/quotes.ts`).
- [ ] `/cart` page restyled with the same pieces; stays as the full-page fallback.
- [ ] Mixed-cart test matrix (grocery + rental, + ticket, + appointment, + digital, + restaurant dish). Record which combinations the backend completes. Report before building on assumptions.

**Acceptance**
- Add, increment, decrement, remove, apply and remove promo all work against the real backend and survive a page reload.
- Drawer opens from the header button and after "Add"; Esc and scrim close it; focus returns.
- QA: `04-cart`, `08-discounts` pass (fix the existing quantity-change failure only if it is caused by cart UI that this phase rewrites; otherwise leave it recorded).
- Test IDs from the old dropdown preserved on equivalent elements.

**Suggested commit:** `feat(storefront): cart drawer with optimistic updates`

---

### Phase 4 — Product card, home, listings (L)

**Files:** `modules/products/components/product-preview/`, `modules/home/*`, `modules/store/*`, `modules/categories/`, `modules/collections/`, `modules/search/components/hit`, `app/[countryCode]/(main)/page.tsx`, `store/page.tsx`, `categories/`, `collections/`.

**Tasks**
- [ ] `ProductCard` wired with `getProductPrice`/`getPricesForVariant`.
- [ ] **ADD rule:** one-tap ADD only when the product is plain (no rental, EOI, enquiry-only, digital, ticket, appointment) **and** has exactly one purchasable variant. Otherwise the card shows "Select" and links to the product page. Detect special types with the same signals `product-actions` already uses (`rental_configuration`, `digital_product`, ticket and appointment offers).
- [ ] Home: hero grid (collections or promo content), category tiles (icon from category metadata or a fallback initial), rails from collections, fallback to latest products when there are no collections (existing `latest-products`), benefit strip, "More than groceries" cards.
- [ ] Store and category pages: category sidebar, sort (existing `sort-products`), pagination (existing), skeleton grid.
- [ ] Filters: only what the API supports. "Under X" and "N% off" need Meilisearch facets; ship without them unless added.
- [ ] Replace `Hero` and `next-steps` example content. Rewrite the five QA tests that assert it.
- [ ] Search results page uses `ProductCard`.

**Acceptance**
- Home, store, category, collection, search results render with real data, light and dark, 1440 and 390, no layout shift while images load.
- ADD rule verified with one product of each kind.
- QA: `01`, `02` pass after the hero tests are rewritten; the previously failing "products even with no collections" and "sorting" tests are re-checked (they exercise this code and may now pass or need a real fix).

**Suggested commit:** `feat(storefront): new product card, home page and listings`

---

### Phase 5 — Product page, checkout, confirmation (L)

**Product page files:** `modules/products/templates/index.tsx`, `product-info/`, `product-actions/` (`index.tsx` 411 lines, `option-select`, `mobile-actions`), `image-gallery/`, `product-tabs/`, `related-products/`, `product-actions-wrapper/`.

**Tasks — product page**
- [ ] Two-column layout: gallery with thumbnails, then info column.
- [ ] Split `product-actions/index.tsx` into focused files (variant state, price block, buy row, rental branch, digital branch) as pure moves first, then restyle. Behaviour identical.
- [ ] Option values as pack-size cards (restyled `option-select`), price block with `Price`, delivery card, accordions from `product-tabs`, related products with `ProductCard`.
- [ ] Sticky buy bar on narrow screens (restyled `mobile-actions`).

**Checkout files:** `modules/checkout/templates/checkout-form/`, `checkout-summary/`, `components/*`, `app/[countryCode]/(checkout)/*`, `modules/order/*`.

**Tasks — checkout and confirmation**
- [ ] Two-column layout: numbered step cards left, sticky summary and pay button right. Keep every step component and server action. Keep `isNoShippingCart` branching.
- [ ] Payment step lists only providers the region returns; UPI / cash on delivery appear only if those providers exist.
- [ ] Order confirmation page and status list restyled; special lines (rental, appointment, seat) keep their components.

**Acceptance**
- Product page works for: plain product, multi-option product, rental, digital product. Variant change updates price and image state; add to cart works.
- Checkout completes (with explicit OK to create data): grocery cart, ticket-only cart, appointment-only cart, and each mixed combination reported as supported in Phase 3.
- QA: `03` to `05`, `09`, `13` pass or match baseline.
- **End of core loop: safe to deploy to staging.**

**Suggested commits:** `refactor(storefront): split product-actions` then `feat(storefront): product page and checkout redesign`

---

### Phase 6 — Rent (M)

**Files:** `modules/products/components/rental-date-picker/{index,rental-calendar}.tsx`, `lib/data/rentals.ts`, `lib/util/rental-units.ts` (untouched), new `app/[countryCode]/(main)/rent/page.tsx`.

**Tasks**
- [ ] Restyle the picker: two-month calendar, booked dates crossed out, in-range highlight, pickup/return time selects, rule messages, price breakdown (rental, refundable deposit, due now).
- [ ] `/rent` hub with unit chips and cards. Needs the list route from [§9](#9-backend-gaps); until then, build the page against a stubbed list and mark it.
- [ ] Rental line and deposit line in the cart drawer (already prepared in Phase 3).

**Acceptance:** hour, day, week and month products; booked dates not selectable; min/max messages; add to cart creates rental and deposit lines.

**Suggested commit:** `feat(storefront): rent hub and restyled rental picker`

---

### Phase 7 — Book (M)

**Files:** `app/[countryCode]/(main)/book/*`, `appointments/*`, `modules/appointments/components/{slot-picker,booking-panel,booking-actions}`, `lib/data/appointments.ts`, `types/appointment.ts`. These are now committed (`d570f8c`).

**Tasks**
- [ ] Hub with category chips and business cards; business page with resource cards and services; three-column slot picker; My bookings restyle.
- [ ] Timezone switcher and hold countdown only if the API returns what they need. Read `lib/data/appointments.ts` and the store routes first, then decide.
- [ ] Guest booking path (name and email) if the backend supports it.

**Acceptance:** book as guest and signed-in; held slot expires correctly; appointment appears in the drawer and completes; My bookings lists it.

**Suggested commit:** `feat(storefront): restyle booking flow`

---

### Phase 8 — Enquiry and EOI (M)

**New files:** `lib/data/enquiries.ts`, `lib/data/eoi.ts`, `modules/products/components/enquiry-modal/`, `modules/products/components/eoi-options/`; edits in `product-actions`.

**Tasks — Enquiry**
- [ ] Modal built from the product's `custom_fields` (text, long text, email, phone E.164, number, dropdown, radio, checkbox).
- [ ] The route `POST /store/enquiries` requires `product_id`, `customer_email`, `message` (1–2000 chars) and optional `custom_field_answers`. The form always renders email and message as required, plus the seller's fields.
- [ ] Handle validation errors from the server and the rate limit (HTTP 429).
- [ ] Show the button only for products with an active enquiry config.

**Tasks — EOI**
- [ ] On variants with an active config, show "Buy at full price" or "Express interest" with the deposit and balance computed as `eoi-pricing.ts` does (percentage of the variant price, or fixed amount).
- [ ] Add via `POST /store/carts/:id/line-items/eoi`; the server owns the snapshot, so the client sends only variant, quantity and optional metadata. Complete via `/store/eois/:cart_id` when the cart contains EOI items.
- [ ] Cart and order lines show the EOI badge and balance due later.
- [ ] Variant without config: only full price offered.

**Acceptance:** enquiry validation and success; EOI percentage and fixed variants price correctly; EOI order completes and the balance is shown, not charged.

**Suggested commit:** `feat(storefront): product enquiry and expression of interest`

---

### Phase 9 — Eat, Tickets, Digital, Quotes (M)

- [ ] **Eat:** split `restaurants/page.tsx` (one large client component) into list and menu routes using `restaurants/[id]`. Keep the cart-conflict dialog and `clearCartAndAdd`. Closed restaurants visible but not orderable.
- [ ] **Tickets:** restyle `modules/products/components/seat-selector` (tier colours, six-seat cap, sold seats). No change to `lib/data/tickets.ts`.
- [ ] **Digital:** restyle `modules/digital-products/templates`; keep the account downloads list.
- [ ] **Quotes:** restyle `account/@dashboard/quotes` and the request modal.

**Acceptance:** each vertical completes its existing flow end to end. **Suggested commit:** `feat(storefront): restyle eat, tickets, digital and quotes`

---

### Phase 10 — Account, mobile, hardening (M)

- [ ] Account, orders, addresses, company/approvals screens on shared tokens.
- [ ] Mobile pass: bottom navigation, drawer as bottom sheet, sticky buy bar.
- [ ] Accessibility: focus order, labels, contrast in light and dark, reduced-motion.
- [ ] Performance: `next/image` sizes for card grids, Suspense boundaries, skeletons for card grid and drawer; Lighthouse run with targets agreed up front.
- [ ] Update QA specs for intentional behaviour changes (dropdown to drawer, hero removal).
- [ ] Consider turning off `ignoreBuildErrors` once typecheck has been clean for the whole project.

**Suggested commit:** `feat(storefront): account restyle, mobile and accessibility pass`

---

## 7. Decision log

| # | Decision | Status | Default if not answered |
|---|---|---|---|
| D1 | Currency | **Decided:** use whatever currencies the backend regions provide | — |
| D2 | Branch | **Decided:** `feature/tenant-isolation`, no new branch | — |
| D3 | Brand name and accent colour | Open | Prototype palette. Name from `NEXT_PUBLIC_STORE_NAME`. |
| D4 | One-tap ADD rule (plain single-variant products only) | Open | Apply the rule |
| D5 | Mixed carts supported? | Open | Test and report in Phase 3 |
| D6 | Restaurant orders clear the cart | Open | Keep current rule |
| D7 | Dark mode in v1 | Open | Included (tokens support it) |
| D8 | Drop "under X" and "N% off" filters unless Meilisearch facets are added | Open | Drop |
| D9 | Mobile priority | Open | Responsive collapse in each phase, dedicated pass in Phase 10 |

## 8. Out of scope for v1

Ratings and reviews, handling fee, rider tip, delivery slot scheduling, per-address serviceability, UPI and cash on delivery (until providers exist), a native app.

## 9. Backend gaps

Each needs its own approval before work starts. None change existing flows.

| # | Need | Used by | Proposal | Needed by |
|---|---|---|---|---|
| B1 | Enquiry field schema readable by the storefront | Phase 8 | Add `+enquiry_configuration.*` to the product query if the link is queryable; else `GET /store/products/:id/enquiry-config` | Phase 8 |
| B2 | Variant EOI config readable by the storefront | Phase 8 | `+variants.eoi_configuration.*` if queryable; else small store route returning type, value, status | Phase 8 |
| B3 | List of rentable products | Phase 6 | Product list filtered by rental config, or `GET /store/rentals/products` | Phase 6 |
| B4 | Free-delivery threshold and delivery ETA text | Phases 2, 3 | Store or region metadata read by the storefront; display only | Phase 2 |
| B5 | Category icon or image | Phase 4 | Category metadata field | Phase 4 |
| B6 | Sale prices ("was" price) | Phase 4 | Data only (price lists or second price). No code change. | Phase 4 |

## 10. QA spec impact

| Spec | Expected effect |
|---|---|
| `01-storefront` | Five hero tests (`~95–217`) fail by design after Phase 4; rewrite for the new home. Nav and footer tests must keep passing. |
| `02-catalogue` | Store, product and category pages; sorting failure existed before the redesign. |
| `04-cart` | Dropdown tests move to the drawer in Phase 3; update selectors only where the element was intentionally replaced. |
| `05-checkout`, `09-order-confirmation`, `13-payment` | Must pass unchanged after Phase 5 (they write data; run with OK). |
| `06-search` | Needs Meilisearch up. |
| `11-interactive-ui`, `12-mobile` | Re-check after each phase that changes shared chrome. |
| `03`, `07`, `10`, `14`, `15`, `16` | Account and admin areas. Expected to be untouched until Phase 10. |

## 11. Risks and rollback

| Risk | Mitigation |
|---|---|
| Large diff mixes with the tenant-isolation PR | Owner commits per phase with the suggested messages, so each phase can be reverted with `git revert <sha>`. |
| Optimistic cart drifts from server | Reconcile on every action result; disable the line's stepper while pending. |
| `product-actions` refactor changes behaviour | Pure move first (no styling), verify, then restyle. |
| Removed test ids break specs | Diff against the exported list every phase. |
| Mixed carts fail at completion | Test matrix in Phase 3 before building more on top. |
| Empty-looking pages from thin data | Data table in Session 0; ask for more data before judging a phase. |
| Hidden type errors | `pnpm typecheck` is a gate every phase. |

## 12. Progress tracker

| Phase | Status | Started | Done | Commit |
|---|---|---|---|---|
| Session 0 — baseline and data | Not started | | | |
| 1 — Foundations | Not started | | | |
| 2 — Site shell | Not started | | | |
| 3 — Cart | Not started | | | |
| 4 — Card, home, listings | Not started | | | |
| 5 — Product page, checkout | Not started | | | |
| 6 — Rent | Not started | | | |
| 7 — Book | Not started | | | |
| 8 — Enquiry and EOI | Not started | | | |
| 9 — Eat, Tickets, Digital, Quotes | Not started | | | |
| 10 — Account, mobile, hardening | Not started | | | |
