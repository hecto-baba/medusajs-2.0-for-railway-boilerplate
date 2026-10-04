# Storefront Redesign — Quick-Commerce Web Experience — Plan

Scope: `medusajs-2.0-for-railway-boilerplate/storefront/` (Next.js 15 App Router, Tailwind + `@medusajs/ui`), plus a small number of backend additions listed in [§5](#5-backend-gaps).

Design reference: the approved clickable prototype (Artifact "Express Web Storefront"). It covers Home, Category, Product, Cart drawer, Checkout, Confirmed, Rent (hub + product), Book (hub + business + slot picker), Enquiry form, Expression of Interest, Quote request, Eat (list + menu), Tickets, Digital. The prototype's brand name ("express"), colours and products are placeholders.

## 1. Goal

Replace the stock Medusa starter look with a dense, fast, quick-commerce web storefront, **without** changing how any existing commerce flow works. Every vertical that exists today (rent, book, tickets, digital, eat, quotes) keeps its backend flow and gains the new look; enquiry and EOI get their first storefront UI.

Non-goals: new backend business logic beyond [§5](#5-backend-gaps), a native app, copying Zepto's brand assets or copy.

## 2. What the code looks like today (verified)

| Area | Finding | Consequence |
|---|---|---|
| Git state | The project is a git repo (remote `hecto-baba/...`). Current branch `feature/tenant-isolation` has **142 uncommitted files** (85 backend, 36 sellers, 16 storefront, 5 docs). The storefront ones include the unfinished Book pages and edits to `nav`, `checkout-form`, `cart/item`, `order/item` that this redesign also touches. Team workflow (`docs/GIT_WORKFLOW.md`): feature branch off `dev`, PR into `dev`, then `qa`, then `main`. | Phase 0 must isolate the redesign from that work-in-progress, and must never commit or discard it. Book (Phase 7) depends on that work being merged first. |
| Styling | Tailwind with `@medusajs/ui-preset`, `ui-*` tokens, `content-container`, system Inter | New tokens extend the preset. Medusa UI forms stay usable underneath. |
| Existing tests | `storefront/qa/*.spec.ts` (11 files) and `e2e/` drive the UI through `data-testid` | Every `data-testid` must survive the restyle. Phase 0 records them. |
| Type checking | `next.config.js` sets `ignoreBuildErrors: true` | Run `pnpm typecheck` ourselves. The build will not catch type errors. |
| Product page | `product-actions/index.tsx` (411 lines) already handles variants, rental, digital, quantity | Restyle and split it. Do not rewrite it. |
| Cart | `cart-dropdown` (275 lines) + `/cart` page + `lib/data/cart.ts` (add, update, delete, promos, `clearCartAndAdd`) | Drawer replaces the dropdown. `/cart` stays as a full page. Server actions are reused as is. |
| Checkout | Stepped sections: Addresses, Shipping, Payment, Review. Already skips shipping for ticket and appointment carts (`isNoShippingCart`) | Matches the prototype's "no delivery step for bookings". Layout changes, logic does not. |
| Pricing | `getPricesForVariant` already returns original and calculated price and percentage diff | "% OFF" badges and strike-through prices need no backend work, but only appear where a sale price or price list exists. |
| Payments | Stripe, PayPal, manual (`lib/constants.tsx`) | UPI and cash on delivery in the prototype are not available yet. |
| Currency | Seed creates `eur` and `usd` regions only | The prototype shows ₹. Needs a region decision ([§7](#7-open-decisions)). Formatting stays on `convertToLocale`. |
| Enquiry | Backend ready (`POST /store/enquiries`, per-product custom fields). **No storefront code.** | New UI and data layer. |
| EOI | Backend ready (`POST /store/carts/:id/line-items/eoi`, variant-level config). **No storefront code.** | New UI and data layer. |
| Rent hub | Rental availability and blocked-date routes exist per product. No route lists rentable products. | Backend gap. |
| Delivery ETA | The `delivery` module serves restaurant orders. Nothing models "9 minutes" for groceries. | v1 shows a configured ETA. Real slots are a later backend project. |
| Ratings, handling fee, tip | Not modelled | Dropped from v1 (see [§5](#5-backend-gaps)). |

## 3. Approach

1. **Branch, not flag.** Work on a `feature/storefront-v2` branch off `dev` and restyle in place. A runtime flag would mean maintaining two versions of ~150 files.
2. **Foundations first.** Build tokens and a small shared component set once, then rebuild pages from them. This avoids restyling files one at a time.
3. **Vertical slices.** After Phase 5 the core grocery loop (browse, add, cart, checkout) is complete and shippable. Every later phase adds one vertical.
4. **Restyle logic-heavy files, do not rewrite them.** Pickers, seat maps, checkout actions and cart server actions keep their behaviour. Markup and classes change.
5. **Preserve `data-testid`.** New elements get new ids following the existing convention.
6. **Keep server components where they are.** Header, listings and the product page stay server-rendered. Only steppers, drawer, pickers and modals are client components.

### Shared building blocks (Phase 1)

Location: `src/modules/common/components/` (matches the repo's layout) and tokens in `tailwind.config.js` / `globals.css`.

| Component | Used by |
|---|---|
| Design tokens (brand, lime accent, ink, surface, line, green, radius scale, shadow) as CSS variables with a dark set, mapped into Tailwind | everything |
| Fonts via `next/font` (display face and body face) | everything |
| `Price` (current, original, % off, currency via `convertToLocale`) | cards, PDP, cart, checkout |
| `DiscountBadge`, `Chip` | cards, PDP, rent, book |
| `QtyStepper` + `AddButton` (ADD becomes `− n +`) | cards, PDP, cart lines |
| `Drawer` (right) and `Modal`, focus trapped, Esc closes | cart, enquiry, quote, conflict |
| `FreeDeliveryBar`, `BillBreakdown` | drawer, cart page, checkout |
| `ProductCard` | home, listings, related, search |
| `SectionHeader`, `Grid`, `Breadcrumbs` | all pages |
| `Skeleton` variants for the new card and drawer | loading states |

A dev-only `/dev/ui` route renders every component in every state for review. It is excluded from production builds.

## 4. Phases

Sizes are relative (S under a day, M a few days, L about a week). Each phase ends with an acceptance gate; the next phase does not start until it passes.

### Phase 0 — Safety and baseline (S)

- [ ] Isolate the work: create `feature/storefront-v2` off `origin/dev` (per `docs/GIT_WORKFLOW.md`), in a separate git worktree so the 142 uncommitted files on `feature/tenant-isolation` are untouched. Do not `git init`, commit, stash or discard anything that is not ours.
- [ ] Run `pnpm typecheck` and the existing QA suite (`test:qa`) against the current UI. Record failures that already exist so they are not blamed on the redesign.
- [ ] Export every `data-testid` in `src/` to `docs/plan/storefront-testids.txt`. A grep check in CI later confirms none were removed.
- [ ] Capture baseline screenshots of the main pages with Playwright for before/after comparison.
- **Gate:** branch created off `dev` without touching the existing working tree, known test status.

### Phase 1 — Foundations (M)

- [ ] Tokens, dark mode (`darkMode: "class"` is already set; `data-mode` in the root layout is currently fixed to light), fonts, radius and shadow scale.
- [ ] Build the shared components in [§3](#shared-building-blocks-phase-1) and the `/dev/ui` page.
- [ ] Ensure `@medusajs/ui` inputs still look right against the new tokens (account and address forms use them).
- **Gate:** `/dev/ui` reviewed in light and dark, typecheck clean, no change to existing pages' behaviour.

### Phase 2 — Site shell (M)

Files: `modules/layout/templates/nav`, `footer`, `side-menu`, `app/[countryCode]/(main)/layout.tsx`, `lib/data/categories.ts`.

- [ ] Header: logo, delivery chip (configured ETA and the customer's default address or region), wide search, account, cart button with count and total.
- [ ] Category nav row from `listCategories()`. Vertical links (Eat, Book, Rent, Tickets, Digital) shown only when that feature has content or is enabled.
- [ ] Search typeahead using the existing Meilisearch client (`lib/search-client.ts`). Keep `/search` and `/results/[query]`.
- [ ] Footer restyle. Checkout keeps its own minimal header via `(checkout)/layout.tsx`.
- **Gate:** header works signed in and out, search suggestions return real products, QA nav tests pass.

### Phase 3 — Cart foundation (L)

Files: `modules/layout/components/cart-dropdown` (replaced by a drawer), `cart-button`, `modules/cart/*`, `lib/data/cart.ts` (reused).

- [ ] Client cart context with optimistic updates (`useOptimistic`) around the existing server actions so the stepper feels instant and reconciles with the server result.
- [ ] Cart drawer: free-delivery progress (threshold from a store setting, see [§5](#5-backend-gaps)), grouped lines, steppers, "complete your cart" suggestions, coupon (existing `applyPromotions`), bill breakdown, cancellation note, checkout button.
- [ ] Reuse the existing line-item components for rental dates, appointment info and seat info so special lines render correctly inside the drawer. Show the rental deposit as its own line. Show an EOI line with its balance.
- [ ] Restyle `/cart` page to match; keep it as the no-JS and deep-link fallback.
- [ ] Request-a-quote entry point under the checkout button (reuse `RequestQuoteButton`, restyled as a modal).
- **Gate:** add, increment, decrement, remove and promo all work against the real backend. Mixed carts (grocery plus a rental plus a ticket) render correctly. `04-cart` and `08-discounts` QA specs pass.

### Phase 4 — Product card, home, listings (L)

Files: `modules/products/components/product-preview`, `modules/home/*`, `modules/store/*`, `modules/categories`, `modules/collections`, `app/.../page.tsx`, `store/page.tsx`.

- [ ] `ProductCard` using `getPricesForVariant` for price, original price and % off.
- [ ] **ADD rule (needs your sign-off):** a card shows one-tap ADD only when the product has one purchasable variant and is a plain product. Products with several options, rentals, EOI, enquiry-only, digital, tickets or appointments show "Select" or "View" and go to the product page. The prototype always had a default size, which real data does not guarantee.
- [ ] Home: hero grid (collections or promo content), category tiles, product rails from collections, benefit strip, "More than groceries" cards linking to the verticals. Today's seed creates no collections, so the page needs a latest-products fallback (already in `latest-products`).
- [ ] Listings: category sidebar, sort (reuse `sort-products`), filters. Server-side filtering is limited to what Medusa supports, so "under ₹100" and "20% off" are either Meilisearch facets or dropped from v1.
- **Gate:** home and category pages render with real data in light and dark, no layout shift, `01-storefront` and `02-catalogue` specs pass.

### Phase 5 — Product page and checkout: core loop complete (L)

Product page — files: `modules/products/templates/index.tsx`, `product-info`, `product-actions` (+ `option-select`, `mobile-actions`), `image-gallery`, `product-tabs`, `related-products`.
- [ ] Two-column layout: gallery with thumbnails, then info, pack-size cards (restyled `option-select`), price block, delivery card, buy row, accordions.
- [ ] Split `product-actions/index.tsx` into smaller pieces while moving it (variant state, price, buy row, rental branch, digital branch). Behaviour stays identical.
- [ ] Sticky buy bar for narrow screens (restyled `mobile-actions`).

Checkout — files: `modules/checkout/templates/checkout-form`, `checkout-summary`, `components/*`, `(checkout)/checkout/page.tsx`, `order/confirmed`.
- [ ] Two-column layout: numbered step cards on the left, sticky summary and pay button on the right. Keep every existing step component and server action. Keep `isNoShippingCart` behaviour, which already matches the prototype.
- [ ] Payment shows the providers the region actually has. UPI and cash on delivery appear only once those providers are configured.
- [ ] Order confirmation page and status list restyled.
- **Gate (end of core loop):** complete real orders for a grocery cart, a mixed cart and a ticket-only cart. `03` to `05`, `09` QA specs pass. Typecheck clean. This is a safe point to deploy to a staging URL.

### Phase 6 — Rent (M)

Files: `modules/products/components/rental-date-picker` (+ `rental-calendar`), `lib/data/rentals.ts`, `app/.../products/[handle]`, new `app/.../rent/page.tsx`.

- [ ] Restyle the picker: two-month calendar, crossed-out booked dates, in-range highlight, pickup and return time selects, rule messages, price breakdown (rental, refundable deposit, due now). The unit logic (`lib/util/rental-units`) stays untouched.
- [ ] New `/rent` hub with unit filter chips. **Needs a backend list route** ([§5](#5-backend-gaps)).
- **Gate:** rent by hour, day, week and month; booked dates cannot be chosen; deposit line appears in the cart.

### Phase 7 — Book (M)

Files: `app/.../book/*`, `modules/appointments/components/{slot-picker,booking-panel,booking-actions}`, `appointments/my`, `lib/data/appointments.ts`.

- [ ] Hub with category chips, business page with resource cards and services, three-column slot picker (resource and service, date and time, summary and guest details).
- [ ] Timezone switcher and hold countdown. Show them only to the extent the backend returns them (Plan 3 specifies timezone-aware slots and holds with `expires_at`). Confirm what is shipped before building the UI.
- [ ] Restyle "My bookings".
- **Gate:** book as a guest and as a signed-in customer; a held slot expires correctly; appointment appears in the cart drawer and completes.

### Phase 8 — Enquiry and EOI (M)

New storefront code. Files: new `lib/data/enquiries.ts`, `lib/data/eoi.ts`, new `modules/products/components/enquiry-modal`, `eoi-options`, edits in `product-actions`.

- [ ] **Enquiry:** modal built from the product's `custom_fields` (text, long text, email, phone with E.164 check, number, dropdown, radio, checkbox), submitted to `POST /store/enquiries`. Note: the route requires `customer_email` and `message`, so the form always includes those two as required, and renders the seller's custom fields on top. (The prototype's message field was optional. It should be required.) The route is rate limited, so the UI must handle 429.
- [ ] **EOI:** on variants with an active config, show "Buy at full price" or "Express interest" with the deposit and balance computed the same way as `eoi-pricing.ts`. Add through `POST /store/carts/:id/line-items/eoi`. Complete through `/store/eois/:cart_id`. Cart line shows the EOI badge and balance.
- [ ] Both need the storefront to read the config. See [§5](#5-backend-gaps).
- **Gate:** enquiry with required, email and phone validation errors, and a successful send; EOI percentage and fixed variants price correctly; a variant without config offers only full price.

### Phase 9 — Eat, Tickets, Digital, Quotes (M)

- [ ] **Eat:** `restaurants/page.tsx` is one 300-line client component. Split it into list and menu routes, restyle, keep the cart-conflict dialog and `clearCartAndAdd`. Closed restaurants stay visible but not orderable.
- [ ] **Tickets:** restyle `seat-selector` (price-tier colours, six-seat limit, sold seats). Logic and `lib/data/tickets.ts` unchanged.
- [ ] **Digital:** restyle `modules/digital-products/templates`; keep the account download list.
- [ ] **Quotes:** modal for the request, restyle `account/quotes`.
- **Gate:** each vertical completes its existing flow end to end.

### Phase 10 — Account, mobile, dark mode, hardening (M)

- [ ] Restyle account, orders, addresses, B2B screens with the shared tokens (mostly class changes).
- [ ] Mobile: collapse header, bottom navigation, sticky buy bar, drawer as a bottom sheet. The prototype is desktop-first, so mobile gets its own review pass with screenshots.
- [ ] Dark mode review, accessibility pass (focus states, drawer and modal focus trap, labels, contrast), image optimisation (`next/image` sizes for card grids), Suspense boundaries and skeletons, Lighthouse check.
- [ ] Update QA specs for intentional behaviour changes (for example the cart dropdown becoming a drawer).
- **Gate:** typecheck, full QA suite, no removed `data-testid`, Lighthouse and accessibility targets agreed up front.

### Phase 11 — Rollout (S)

- [ ] Staging deploy on Railway from `storefront-v2`, smoke test with real data and each payment method.
- [ ] Merge to main, deploy, watch errors. Keep the previous deployment available for rollback.

## 5. Backend gaps

Small, additive. None change existing flows.

| Need | Used by | Proposed change | Phase needed by |
|---|---|---|---|
| Read a product's enquiry field schema | Enquiry modal | Add `+enquiry_configuration.*` to the storefront product query if the link is queryable, otherwise a `GET /store/products/:id/enquiry-config` route | 8 |
| Read a variant's EOI config | EOI options | Same approach: `+variants.eoi_configuration.*` or a small store route returning type, value and status | 8 |
| List rentable products | Rent hub | `GET /store/products` filtered by rental config, or `GET /store/rentals/products` | 6 |
| Free-delivery threshold and ETA text | Drawer, header | Store metadata or region metadata read by the storefront. Display only | 2 and 3 |
| Sale and "was" prices | % OFF badges | Price lists or a second price. No code change, but data must exist for badges to appear | 4 |
| Category icons or images | Category tiles | Category metadata (`icon` or image URL) | 4 |
| UPI and cash on delivery | Checkout | New payment providers. Out of scope for v1 | 5 |

Deliberately dropped from v1 because the backend has no model: ratings and review counts, handling fee, rider tip, delivery slot scheduling (Express is shown as the only option, with the ETA from config), per-address serviceability.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Mixed carts (grocery, rental, appointment, ticket together) hit different completion routes (`complete-all`, `complete-tickets`, `complete-appointment`, `complete-digital`) | Test each combination in Phase 3 and 5 before building on top. Decide early if mixed carts are officially supported. |
| Hidden type errors, because builds ignore them | Typecheck is a gate in every phase. Consider turning `ignoreBuildErrors` off once the baseline is clean. |
| Existing QA specs break on markup changes | Preserve `data-testid`, record them in Phase 0, run the suite per phase. |
| Optimistic cart gets out of sync with the server | Reconcile on every action result. Disable steppers while a request is in flight for the same line. |
| `product-actions` refactor changes behaviour | Move code in small steps with the rental and digital cases covered by tests first. |
| ADD button on multi-variant products confuses people | The Phase 4 rule: only single-variant plain products get one-tap ADD. |
| Design drifts from the prototype | Review each phase against the prototype screens, side by side screenshots. |
| Scope creep into backend | Anything not in [§5](#5-backend-gaps) is a separate plan. |

## 7. Open decisions

1. **Currency and region:** the prototype shows ₹, the seed has EUR and USD. Add an INR region and prices, or keep the current currencies and treat ₹ as placeholder?
2. **Brand:** name, logo and accent colour. Phase 1 uses the prototype palette unless told otherwise.
3. **Mixed carts:** are grocery plus rental plus booking in one cart an intended supported case, or should the cart restrict combinations (as restaurants already do)?
4. **Grocery vs food carts:** keep today's rule that restaurant orders clear the cart?
5. **Mobile priority:** ship desktop and responsive collapse first, or give mobile equal weight from Phase 4?
6. **Filters:** is it acceptable to drop "under ₹100" and "20% off" filters in v1 unless Meilisearch facets are added?
7. **Dark mode:** ship in v1 or later? The tokens will support it either way.

## 8. Definition of done

- Every page in the prototype exists in the storefront with real data.
- No existing flow regressed: all QA specs pass, no `data-testid` lost, typecheck clean.
- Core loop and each vertical complete a real order on staging.
- Light and dark, desktop and phone reviewed with screenshots against the prototype.
