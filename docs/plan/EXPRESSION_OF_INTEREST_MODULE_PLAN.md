# Expression of Interest (EOI) Module — Plan

Scope: `medusajs-2.0-for-railway-boilerplate/backend/` (new module, links, workflows, API
routes, admin widget) **and** `sellers/` (vendor-facing config UI). Both surfaces ship
together — confirmed with the user: sellers and platform admin have equal rights to
configure EOI on a product, mirroring the existing Rental module's admin/vendor parity
rather than the Product Enquiry module's admin-first, sellers-later split.

## Goal

Let an admin or a seller mark a product as eligible for "Expression of Interest": instead
of (or alongside) buying it outright, a customer can add it to cart for a **fraction of the
price** — a flat amount or a percentage — reserving the item. That partial payment flows
through Medusa's real cart → payment → order pipeline (no bespoke checkout), and the
resulting order carries a durable record of the EOI: what was quoted, what was paid, and
what (if anything) is still owed.

This is a hybrid of two existing modules:
- **`product-enquiry`** — the "interest in a product, tied to a customer" semantics.
- **`rental`** — the "admin-configured per-product value (fixed or % of price), charged as
  its own cart line item, snapshotted into order-line metadata, and persisted as a linked
  module row once the order completes" *mechanism*. This plan copies rental's mechanism
  almost verbatim; it does not reuse rental's code.

## Decisions already made (do not re-litigate mid-build)

| Question | Decision |
|---|---|
| Payment model | EOI value is a **deposit toward the full order**, not the whole transaction. Cart contains the product's full-price line item with `unit_price` overridden to the EOI amount, plus the remaining balance tracked so it can be captured/invoiced later — exactly rental's security-deposit shape (deposit is its own line item, full price is invoiced at true value; here EOI amount *is* the charged line, balance is a separate tracked field, not a second line item — see [§4](#4-cart-time-value-computation)). |
| Value source | Per-product config, editable by **both** platform admin and the owning seller — same rights, same shape as `rental_configuration`. No global store default in v1. |
| Value type | `fixed` (flat currency amount) or `percentage` (of the item's calculated unit price at cart-add time) — same enum as `security_deposit_type`. |
| Who can configure | Admin: any product. Seller: only their own products, enforced by `assertVendorOwnsProduct`-equivalent ownership check (product already links to vendor via `vendor-product.ts`; no new vendor link needed, ownership is transitive through the product exactly like rental derives vendor ownership through `order_id`). |
| Cart mechanism | **Reuses Medusa's existing cart** — the same cart every other flow (rentals, tickets, normal purchases) uses. No parallel checkout. Mirrors `add-to-cart-with-rental.ts` exactly: a workflow wraps core `addToCartWorkflow`, overrides `unit_price`, stamps a metadata snapshot. |
| Order-time persistence | A `create-eoi-for-order` step (mirrors `create-rentals-for-order.ts`) reads line items with EOI metadata off the completed order and writes durable `Eoi` rows, linked to the order and line item. Triggered the same way rentals are: a `/store/eois/:cart_id` route that wraps `completeCartWorkflow` + the EOI-creation step in one workflow, called instead of the generic cart-complete endpoint when the cart contains an EOI item. |
| Payments/remaining balance | v1 scope: **track and expose** the remaining balance (`eoi.remaining_amount`, computed from `product price - eoi value` at the time of quoting). Actually collecting that second payment (a follow-up payment collection / capture) is out of scope for this plan — flagged as Phase 2, same way rental's deposit refund is admin-triggered manually, not automated. |
| Widget placement | Admin: `zone: "product.details.after"`, `backend/src/admin/widgets/product-eoi-config.tsx`. `.before`/`.after` suffixes are deprecated store-wide as of Medusa v2.17.2+ in favor of the unsuffixed zone (dashboard Layout Composer controls ordering instead) — but this repo's existing widgets (`product-rental-config.tsx`, `order-rental-items.tsx`) already standardize on the suffixed form, which the admin-dashboard skill's own guidance explicitly carves out as acceptable ("...unless the project already standardizes on a suffix"). Match the codebase here, not the general default. Seller: a `LayoutComposer.Entry` (or equivalent detail-tab component) under `sellers/src/modules/products/components/detail/`, following the pattern PRODUCTS.md §8 lists as already having an `eoi`-shaped sibling — `rental` is listed there (`detail/ … rental …`), so a `detail/eoi.tsx` (or similar) is the seller-side counterpart. |
| Ownership-check placement — **decided** | The Medusa `building-with-medusa` skill states ownership validation is business logic and belongs in a **workflow step**, given a user id as plain input — never asserted directly in the route (`authentication.md`, "Pattern: Ownership Validation"). This repo's actual shipped vendor routes (`sellers/PRODUCTS.md` §6, `assertVendorOwnsRental`/`assertOwnership` in `src/api/vendors/*/helpers.ts`) do the opposite: assert ownership as the first line of the **route handler**, before the workflow runs. These disagree. **Decision (confirmed with the user): match the codebase convention** — `assertOwnership(req, id)` stays at the top of the Phase 6 route handler, identical to every other vendor route already shipped. This knowingly repeats a pattern Medusa's own docs call an anti-pattern, in exchange for staying consistent with every sibling vendor route in this repo. Not revisited unless the codebase-wide convention changes. |

---

## Current state (confirmed in codebase)

| Piece | Status |
|---|---|
| `expression-of-interest` / any EOI module, model, link, workflow, route, widget | Does not exist — net new |
| Closest mechanism precedent | `backend/src/modules/rental/` — `RentalConfiguration.security_deposit_amount` / `security_deposit_type` (`fixed`\|`percentage`) is the exact value-type pattern to copy for `EoiConfiguration.value_amount` / `value_type` |
| Closest cart-time precedent | `backend/src/workflows/add-to-cart-with-rental.ts` + `backend/src/workflows/steps/validate-rental-cart-item.ts` — computes a price, overrides `unit_price`, stamps metadata |
| Closest order-persistence precedent | `backend/src/workflows/steps/create-rentals-for-order.ts`, triggered from `backend/src/api/store/rentals/[cart_id]/route.ts` via `createRentalsWorkflow` (wraps `completeCartWorkflow.runAsStep` + the persistence step, atomically) |
| Closest product-link precedent | `backend/src/links/product-rental-config.ts` (1:1 writable Product⟷Config) + `backend/src/links/rental-line-item.ts` / `rental-order.ts` (readOnly, keyed on plain `line_item_id`/`order_id` text columns) |
| Closest admin-widget precedent | `backend/src/admin/widgets/product-rental-config.tsx` (config drawer) + `backend/src/admin/widgets/order-rental-items.tsx` (order-page read view) |
| Closest vendor-ownership precedent | `backend/src/api/vendors/rentals/helpers.ts` (`assertVendorOwnsRental`) and `backend/src/api/vendors/products/helpers.ts` (`assertOwnership`) — EOI's product-config route uses the **product** ownership helper directly (`assertOwnership`), since EOI config hangs off a product id, not an order id |
| Route-reachability discipline | Every phase below ends with the route(s) that make that phase's code reachable; a phase is not "done" until something can actually call it. (An earlier draft of this doc cited `product-enquiry` as a cautionary example of a module shipped with no route ever wired up — that claim was checked directly against the codebase and is **false**: `product-enquiry` has five working routes, `admin/enquiries/route.ts`, `admin/enquiries/[id]/route.ts`, `admin/enquiries/[id]/status/route.ts`, `admin/products/[id]/enquiries/route.ts`, and `store/enquiries/route.ts`. The discipline itself — always end a phase at a callable route — is still good practice and is kept below, just without the now-corrected false justification.) |
| Cart/Payment/Order modules touched | Core Medusa `cart`, `order` — via `addToCartWorkflow` / `completeCartWorkflow` (both `runAsStep`, never reimplemented). Payment is untouched directly in v1: capturing the EOI amount is whatever payment flow already runs at cart completion (Stripe, per `@medusajs/payment-stripe` in `medusa-config.js`); EOI only changes the **price** on the line item before that happens. |

---

## Phase 0 — Safety prep

- [ ] Confirm target DB is dev/staging
- [ ] Confirm work happens inside `medusajs-2.0-for-railway-boilerplate/` (its own git repo; the top-level `medusa1` folder is not a repo)
- [ ] Create a feature branch, e.g. `feature/expression-of-interest`

---

## Phase 1 — Module core

### 1.1 Data models

`backend/src/modules/expression-of-interest/models/eoi-configuration.ts` — per-product config:

```ts
import { model } from "@medusajs/framework/utils"

const EoiConfiguration = model.define("eoi_configuration", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  value_type: model.enum(["fixed", "percentage"]).default("percentage"),
  value_amount: model.bigNumber(), // flat currency amount, OR percentage points (0-100) when value_type = "percentage"
  status: model.enum(["active", "inactive"]).default("active"),
})

export default EoiConfiguration
```

`backend/src/modules/expression-of-interest/models/eoi.ts` — the transaction record:

```ts
import { model } from "@medusajs/framework/utils"

const Eoi = model.define("eoi", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  variant_id: model.text(),
  customer_id: model.text().nullable(),
  customer_email: model.text(),
  cart_id: model.text().nullable(),       // populated at add-to-cart time
  order_id: model.text().nullable(),      // populated once the cart completes
  line_item_id: model.text().nullable(),  // populated once the cart completes
  value_type: model.enum(["fixed", "percentage"]),
  value_amount: model.bigNumber(),        // resolved amount actually quoted, snapshotted from config
  quoted_unit_price: model.bigNumber(),   // the product's price at the moment of quoting
  eoi_charged_amount: model.bigNumber(),  // what was actually charged as the cart line's unit_price
  remaining_amount: model.bigNumber(),    // quoted_unit_price - eoi_charged_amount
  status: model.enum(["pending", "converted", "cancelled"]).default("pending"),
})

export default Eoi
```

Both use `model.bigNumber()` for money/percentage fields (matches `security_deposit_amount`
— generates a companion `raw_<field> jsonb` column for precise decimal math).

### 1.2 Service

`backend/src/modules/expression-of-interest/service.ts`:

```ts
import { MedusaService } from "@medusajs/framework/utils"
import Eoi from "./models/eoi"
import EoiConfiguration from "./models/eoi-configuration"

// Thin on purpose, same rationale as ProductEnquiryModuleService: auto-CRUD
// (createEois, listEois, updateEois, createEoiConfigurations, ...) covers
// everything except genuinely query-shaped lookups, added below as needed
// (e.g. hasOpenEoi, once a "one open EOI per customer per product" rule exists).
class ExpressionOfInterestModuleService extends MedusaService({
  Eoi,
  EoiConfiguration,
}) {}

export default ExpressionOfInterestModuleService
```

### 1.3 Module registration

`backend/src/modules/expression-of-interest/index.ts`:

```ts
import ExpressionOfInterestModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const EOI_MODULE = "expressionOfInterest"

export default Module(EOI_MODULE, {
  service: ExpressionOfInterestModuleService,
})
```

Add to `backend/medusa-config.js` → `modules` array:
```js
{ resolve: './src/modules/expression-of-interest' },
```

### 1.4 Migration

Generate via the Medusa CLI from the models above (do not hand-write — every existing
migration in this repo, e.g. `product-enquiry`'s and `rental`'s, is CLI-generated raw SQL,
checked in as a `Migration<timestamp>.ts` class with `up()`/`down()`). Run from
`backend/`:
```
npx medusa db:generate expression-of-interest
```

- [ ] **Checkpoint:** migration runs clean against dev DB; module boots (`npx medusa develop` starts without error).

---

## Phase 2 — Module links

`backend/src/links/product-eoi-config.ts` — 1:1 writable, Product ⟷ EoiConfiguration:
```ts
import { defineLink } from "@medusajs/framework/utils"
import EoiModule from "../modules/expression-of-interest"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  ProductModule.linkable.product,
  EoiModule.linkable.eoiConfiguration
)
```

`backend/src/links/product-eoi.ts` — Product ⟷ Eoi, one-to-many, writable:
```ts
export default defineLink(
  { linkable: ProductModule.linkable.product, isList: true },
  EoiModule.linkable.eoi
)
```

`backend/src/links/customer-eoi.ts` — Customer ⟷ Eoi, one-to-many, optional (guest EOIs
have `customer_id: null`, no link row) — mirrors `customer-enquiry.ts`.

`backend/src/links/eoi-variant.ts` — readOnly, keyed on the existing `variant_id` column:
```ts
export default defineLink(
  { linkable: EoiModule.linkable.eoi, field: "variant_id" },
  ProductModule.linkable.productVariant,
  { readOnly: true }
)
```

`backend/src/links/eoi-order.ts` and `backend/src/links/eoi-line-item.ts` — readOnly, keyed
on `order_id` / `line_item_id`, populated only once the cart completes — mirrors
`rental-order.ts` / `rental-line-item.ts` exactly (no separate `eoi-cart` link: the cart is
transient, association during cart-life is carried in line-item `metadata`, not a module
link — same reasoning rental uses for skipping a `rental-cart` link).

- [ ] **Checkpoint:** `npx medusa exec` a script that queries `product.eoi_configuration.*`
  via `query.graph` returns `null`/empty cleanly for a product with no config yet.

---

## Phase 3 — Cart-time value computation

`backend/src/utils/eoi-pricing.ts` — the fixed/percentage math, centralized (unlike rental,
where the equivalent `calculateRentalPriceStep` exists but the inline logic in
`validate-rental-cart-item.ts` duplicates it — **do not repeat that split here**; every
caller, including any future admin "preview EOI amount" UI, calls this one function):
```ts
export function calculateEoiAmount({
  unitPrice,
  valueType,
  valueAmount,
}: {
  unitPrice: number
  valueType: "fixed" | "percentage"
  valueAmount: number
}) {
  const eoiChargedAmount =
    valueType === "percentage" ? unitPrice * (valueAmount / 100) : valueAmount

  return {
    eoi_charged_amount: eoiChargedAmount,
    remaining_amount: Math.max(unitPrice - eoiChargedAmount, 0),
  }
}
```

`backend/src/workflows/steps/validate-eoi-cart-item.ts` — mirrors
`validate-rental-cart-item.ts`: given a variant (with `product.eoi_configuration.*` and
`calculated_price.*` loaded), returns `{ is_eoi, eoi_charged_amount, remaining_amount,
value_type, value_amount, quoted_unit_price }` if config is `active`, else a pass-through
signal so the caller adds a normal-priced item.

`backend/src/workflows/add-to-cart-with-eoi.ts` — mirrors `add-to-cart-with-rental.ts`
structurally: fetch cart, fetch variant + `product.eoi_configuration.*` +
`calculated_price.*`, `when(...).then(validateEoiCartItemStep)`, `acquireLockStep`,
`transform` to build the line item with `unit_price: eoi_charged_amount` and metadata
`{ eoi_value_type, eoi_value_amount, eoi_quoted_unit_price, eoi_remaining_amount,
is_eoi: true }`, `addToCartWorkflow.runAsStep`, refetch, `releaseLockStep`.

Unlike rental, **no second line item** is added (rental's deposit is refundable and thus
tracked separately; EOI's remaining balance is not yet collected in v1, so it lives only as
metadata + the `Eoi.remaining_amount` column, not a chargeable cart entry).

`backend/src/api/store/carts/[id]/eoi/route.ts` (or extend the existing
`src/api/store/carts/` tree if a line-items-add route already exists there — check before
adding a new one) — `POST`, `req.validatedBody: { variant_id, quantity }`, calls
`addToCartWithEoiWorkflow(req.scope).run({ input: { cart_id: id, ...body } })`.

- [ ] **Checkpoint:** adding an EOI-enabled variant to a cart via this route produces a
  line item whose `unit_price` is the discounted EOI amount, confirmed against the
  product's real calculated price, for both `fixed` and `percentage` configs.

---

## Phase 4 — Order-time persistence

`backend/src/workflows/steps/create-eoi-for-order.ts` — mirrors
`create-rentals-for-order.ts`: filters `order.items` for `metadata?.is_eoi`, calls
`eoiModuleService.createEois(...)` with one row per matching line item, reading the
snapshotted metadata (never re-deriving from current config — same reasoning rental's
comment gives: persist exactly what was charged, not whatever the config says by
checkout), sets `order_id` / `line_item_id` / `status: "converted"`. Has a compensation
function that deletes created rows on rollback, same shape as `create-rentals-for-order.ts`.

`backend/src/workflows/create-eoi-order.ts` — mirrors `create-rentals.ts`: `acquireLockStep`
→ `completeCartWorkflow.runAsStep` → refetch order → `when(...).then(createEoiForOrderStep)`
→ `releaseLockStep` → return `{ order }`.

`backend/src/api/store/eois/[cart_id]/route.ts` — `POST`, mirrors
`src/api/store/rentals/[cart_id]/route.ts` structurally, but adds error handling the
sibling route omits (`error-handling.md` §4 — a raw workflow error should not propagate
unwrapped to the client; "cart not found" and "cart has no EOI item" should surface as
distinct, typed `MedusaError`s rather than an unhandled 500):
```ts
import { MedusaError } from "@medusajs/framework/utils"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { cart_id } = req.params

  try {
    const { result } = await createEoiOrderWorkflow(req.scope).run({ input: { cart_id } })
    res.json({ type: "order", order: result.order })
  } catch (error) {
    if (error instanceof MedusaError) {
      throw error
    }
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Could not complete EOI order for cart ${cart_id}: ${error.message}`
    )
  }
}
```
`createEoiOrderWorkflow` itself (above) is responsible for raising a specific
`MedusaError.Types.NOT_FOUND` if the cart doesn't exist (via `useQueryGraphStep`'s
`throwIfKeyNotFound: true`) — the route's job is only to avoid swallowing or re-wrapping an
already-typed error, per the same section.

This is the endpoint the storefront calls instead of the generic cart-complete endpoint
when the cart contains an EOI item (same convention rentals already established — check
`storefront/src/lib/data/cart.ts` (`placeOrder()`) for how it currently decides to call
`/store/rentals/:cart_id` vs. the default complete-cart call, and extend that same decision
point for EOI rather than adding a second one; note there are two separate rental store
routes to not conflate — `/store/rentals/[cart_id]` for checkout completion, and
`/store/carts/[id]/line-items/rentals` for add-to-cart — Phase 3's route above is analogous
to the latter, Phase 4's route here to the former).

- [ ] **Checkpoint:** completing a cart with an EOI line item produces an order, and a
  linked `Eoi` row exists with `status: "converted"`, `order_id`, `line_item_id` populated,
  queryable via `query.graph({ entity: "eoi", fields: ["id", "status", "order_id",
  "line_item_id", "order.id", "order.display_id"] })` (explicit field list, not `["*"]`).

---

## Phase 5 — Admin API + widget

`backend/src/api/admin/products/[id]/eoi-config/route.ts` — mirrors
`products/[id]/rental-config/route.ts`, with two corrections against the
`building-with-medusa` skill's stated rules (checked directly, not just against the sibling
route — the sibling route's own use of `fields: ["*"]` is itself the anti-pattern the skill
warns against, so it is not copied here):
- `GET` — `req.scope.resolve("query").graph({ entity: "eoi_configuration", fields: ["id", "product_id", "value_type", "value_amount", "status"], filters: { product_id: id } })` (**explicit field list, not `fields: ["*"]`** — `querying-data.md`'s Performance Best Practices names `fields: ["*"]` as the documented bad example), `res.json({ eoi_config: result[0] ?? null })`.
- `POST` — body validated against a Zod schema imported from `@medusajs/framework/zod` (both the schema and its inferred type exported, per `type-export-schema`), handler typed `MedusaRequest<z.infer<typeof PostEoiConfigBodySchema>>` so `req.validatedBody` is typed; wraps the workflow call in try/catch and rethrows as `MedusaError` on failure (`error-handling.md` §4) rather than letting it propagate raw; calls `upsertEoiConfigWorkflow(req.scope).run({ input: { product_id: id, ...req.validatedBody } })`.
- Both handlers registered in `backend/src/api/middlewares.ts` with `validateAndTransformBody`/`validateAndTransformQuery` for their schemas — do not skip this; a route with a Zod schema but no middleware entry silently never validates.

`backend/src/workflows/upsert-eoi-config.ts` — mirrors `upsert-rental-config.ts`: find
existing config by `product_id` via `useQueryGraphStep`, branch `when(...).then(...)` on
create vs. update, `createRemoteLinkStep` on first creation only.

`backend/src/admin/widgets/product-eoi-config.tsx` — mirrors `product-rental-config.tsx`
structurally: `useQuery` against the route above, `useMutation` to upsert, a summary
`Container` + edit `Drawer` with a `Select` (`fixed` \| `percentage`) + `Input` (amount),
`defineWidgetConfig({ zone: "product.details.after" })`.

`backend/src/api/admin/eois/route.ts` (list) and
`backend/src/api/admin/eois/[id]/route.ts` (detail/status transition) — mirror
`ticket-products/route.ts` (list via `req.queryConfig`) and `rentals/[id]/route.ts`
(Zod-validated status POST) respectively. Status transitions here are `pending` →
`cancelled` (admin manually voids an un-converted EOI) — `converted` is only ever set by
Phase 4's step, never directly via this route.

`backend/src/admin/widgets/order-eoi-items.tsx` — optional but recommended, mirrors
`order-rental-items.tsx`: read-only view on the order detail page showing quoted price,
EOI amount charged, and remaining balance for any EOI line items on that order.

- [ ] **Checkpoint:** in `backend/src/admin`, open any product → "Expression of Interest"
  widget appears, config can be created/edited/toggled active-inactive, persists on reload.

---

## Phase 6 — Seller (vendor) parity

Per the confirmed decision, sellers get the **same rights** as admin on their own products
— not a restricted subset. Follows `sellers/PRODUCTS.md` §9's numbered recipe exactly:

1. **Link** — already covered; EOI config ownership is transitive through
   `vendor-product.ts`, no new link needed (same as rental's `/vendors/products/:id/rental-config`).
2. **`backend/src/api/vendors/products/[id]/eoi-config/route.ts`** — same
   `GET`/`POST` shape as the admin route, importing the **same** Zod schema. Phase 5 must
   produce `backend/src/api/admin/products/[id]/eoi-config/validators.ts` as a stated
   deliverable — not a conditional "extract if it turns out rental does this" — exporting
   `PostEoiConfigBodySchema` and its inferred type, imported by both the admin and vendor
   routes, so the two panels cannot drift on request shape.
3. **Scope** — `assertOwnership(req, id)` (from `src/api/vendors/products/helpers.ts`) as
   the first line of the handler, before any read or write — matching every existing vendor
   route in this codebase (decided; see the decisions table above).
4. **Register middleware** — `/vendors/*` is already covered by the blanket
   `authenticate("vendor", ...)` matcher in `src/api/middlewares.ts`; no new entry needed
   for a route nested under `/vendors/products/`.
5. **Typed client helpers** — add to `sellers/src/lib/data/vendor-client.ts` (client reads/
   writes via the proxy) alongside the existing rental-config helpers there.
6. **Build UI** — `sellers/src/modules/products/components/detail/eoi.tsx` (or wherever
   the sibling `rental` detail-tab component lives — `sellers/PRODUCTS.md` §8 lists
   `detail/ … rental …` among the per-product detail sections; add `eoi` next to it,
   registered the same way in the product detail page's tab/section list), reusing the same
   `fixed`/`percentage` + amount form as the admin widget, calling the vendor route via
   `vendor-client.ts`.
7. **Verify isolation** — sign in as vendor A, `GET /vendors/products/<vendor B's product id>/eoi-config` directly, confirm **404**, never 403 (per PRODUCTS.md §6 rule 4).

- [ ] **Checkpoint:** seller signs into `sellers/`, opens one of their own products,
  configures EOI, it matches what the platform admin widget shows for the same product;
  attempting another vendor's product id returns 404.

---

## Typing conventions (apply to every route above, not restated per-phase)

- Every protected route (all `admin/*` and `vendors/*` routes in Phases 5–6) is typed
  `AuthenticatedMedusaRequest<T>`, never bare `MedusaRequest<T>` — the vendor route in
  particular needs `req.auth_context.actor_id` to resolve the calling vendor, which only
  `AuthenticatedMedusaRequest` exposes correctly typed.
- Every Zod schema is imported from `@medusajs/framework/zod` (not the bare `zod` package),
  and each schema file exports both the schema and its inferred type
  (`export type PostEoiConfigBody = z.infer<typeof PostEoiConfigBodySchema>`), per
  `type-request-schema` / `type-export-schema`.
- Every route with a body/query schema gets a matching entry in
  `backend/src/api/middlewares.ts` (`validateAndTransformBody` / `validateAndTransformQuery`)
  — a schema that's defined but never registered there silently never runs.

## Explicitly out of scope (v1)

- Collecting the **remaining balance** after an EOI order is placed (a second payment
  capture/invoice flow). Tracked via `Eoi.remaining_amount`, not automated.
- A customer-facing "make your own offer" amount — value is always admin/seller-set per
  product, never customer-entered (per the decision above).
- A global store-wide default EOI percentage. Every product's config is independent.
- Refund/cancellation workflow for a `converted` EOI (mirrors rental's deposit refund being
  a manual admin action, not automated — same deferral, revisit together later).
