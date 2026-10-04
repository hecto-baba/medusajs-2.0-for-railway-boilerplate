# EOI Variant-Level Configuration — Plan

Scope: `medusajs-2.0-for-railway-boilerplate/backend/` and `sellers/`. Follow-up to
`docs/plan/EXPRESSION_OF_INTEREST_MODULE_PLAN.md`, whose 6 phases are already built and
verified live (module, links, cart/order flow, admin widget, vendor parity). This plan
changes one design decision from that build: where `EoiConfiguration` is scoped.

## Problem being fixed

`EoiConfiguration` is currently scoped to **product**, not variant. In `percentage` mode
this is invisible — the percentage is applied against each variant's own `calculated_price`,
so pricing already varies correctly per variant. In `fixed` mode it is a real bug: every
variant of a product gets the identical flat EOI amount regardless of that variant's actual
price, because `eoi-pricing.ts`'s fixed branch returns `value_amount` unmodified, never
touching the variant's price at all.

Confirmed via direct research (not assumption) that this is the same latent limitation
`rental`'s `security_deposit_amount`/`security_deposit_type` already has today — fixed
deposits are also flat across variants there. No existing module in this codebase solves
"one value, correctly varying per variant" for a fixed amount; the closest working precedent
is `ticket-booking`, which sidesteps the problem entirely by not sharing a config across
variants at all — each `TicketProductVariant` links 1:1 to its own `ProductVariant`.

## Decision

Move `EoiConfiguration` from Product-scoped to **Variant-scoped**, mirroring
`ticket-product-variant.ts`'s link shape: `defineLink(EoiModule.linkable.eoiConfiguration,
ProductModule.linkable.productVariant, { deleteCascade: true })` — writable, one config row
per variant, cascade-deleted if the variant is removed (an improvement over the current
product link, which has no cascade).

**Admin/seller UI changes from a single form to a small table** — one row per variant, each
independently configurable (enable/edit/deactivate), confirmed with the user. This is the
part of this change with real UI work, not just backend plumbing.

## Explicitly not changing

- `Eoi` (the transactional record) already carries `variant_id` — untouched by this plan.
- The `eoi-variant.ts` readOnly link (`Eoi` → `ProductVariant`) — untouched, unrelated to
  `EoiConfiguration`.
- Cart/order mechanics (Phases 3–4 of the original plan) — untouched in shape, only in *which
  entity's config they read*.
- No migration of existing data is needed: `EoiConfiguration` has never been used in
  production (confirmed: this repo's dev DB currently has zero real stores depending on it),
  so the old `eoi_configuration` rows can simply be dropped and recreated with the new shape
  rather than backfilled.

---

## Current state (confirmed via grep, not assumed)

Every file in this codebase referencing `eoi_configuration`/`eoiConfiguration`/`eoi-config`,
confirmed exhaustively:

| File | What changes |
|---|---|
| `backend/src/modules/expression-of-interest/models/eoi-configuration.ts` | `product_id` → `variant_id` |
| `backend/src/modules/expression-of-interest/migrations/Migration20260919174416.ts` | New migration generated on top (never hand-edit an applied migration) |
| `backend/src/modules/expression-of-interest/service.ts` | No code change (still `MedusaService({ Eoi, EoiConfiguration })`) — listed because it re-exports the model |
| `backend/src/links/product-eoi-config.ts` | Replaced by `backend/src/links/variant-eoi-config.ts` (new file; old one deleted) |
| `backend/src/workflows/steps/create-eoi-configuration.ts` | `product_id` → `variant_id` input field |
| `backend/src/workflows/steps/update-eoi-configuration.ts` | No field change (keys off `id`), but compensation function's restore payload changes |
| `backend/src/workflows/upsert-eoi-config.ts` | Query/link-write keyed on `variant_id` instead of `product_id` |
| `backend/src/workflows/steps/validate-eoi-cart-item.ts` | No change — already receives `eoi_configuration` as a parameter, doesn't care how it was fetched |
| `backend/src/workflows/add-to-cart-with-eoi.ts` | Fetch `product.eoi_configuration.*` → fetch `eoi_configuration.*` directly on the variant entity |
| `backend/src/api/admin/products/[id]/eoi-config/route.ts` | Moves to `backend/src/api/admin/products/[id]/variants/[variant_id]/eoi-config/route.ts` (new nested path; old route deleted) |
| `backend/src/api/admin/products/[id]/eoi-config/validators.ts` | Moves alongside the route above (same shared-schema role, new path) |
| `backend/src/api/vendors/products/[id]/eoi-config/route.ts` | Moves to `backend/src/api/vendors/products/[id]/variants/[variant_id]/eoi-config/route.ts`, still imports the shared validator from its new admin path |
| `backend/src/api/middlewares.ts` | Update both matcher paths + both import paths |
| `backend/src/admin/widgets/product-eoi-config.tsx` | Single-form widget → per-variant table (fetches `product.variants.*` + each variant's `eoi_configuration.*`, one row per variant) |
| `sellers/src/modules/products/components/detail/eoi-section.tsx` | Same table treatment as the admin widget |
| `sellers/src/lib/data/vendor-client.ts` | `getVendorEoiConfig(productId)` / `upsertVendorEoiConfig(productId, body)` → `(productId, variantId)` |

**Not in the grep output, confirmed unaffected:** `eoi.ts` (the `Eoi` model), `eoi-variant.ts`,
`eoi-order.ts`, `eoi-line-item.ts`, `create-eoi-for-order.ts`, `create-eoi-order.ts`, both
`api/store/*` routes, `order-eoi-items.tsx`, `customer-eoi.ts`, `product-eoi.ts`.

---

## Phase 0 — Safety prep

- [ ] Confirm target DB is dev/staging (same Railway dev instance used for the original build)
- [ ] Confirm zero real `eoi_configuration` rows exist before dropping/recreating the table:
  ```sql
  select count(*) from eoi_configuration;
  ```
  If this is non-zero, stop and write a backfill step instead of the drop-and-recreate below —
  do not silently discard real data.

---

## Phase 1 — Model, link, migration

### 1.1 Model

`backend/src/modules/expression-of-interest/models/eoi-configuration.ts`:
```ts
export const EoiConfiguration = model.define("eoi_configuration", {
  id: model.id().primaryKey(),
  variant_id: model.text(),
  value_type: model.enum(["fixed", "percentage"]).default("percentage"),
  value_amount: model.bigNumber(),
  status: model.enum(["active", "inactive"]).default("active"),
})
```
Only `product_id` → `variant_id` changes; everything else is identical.

### 1.2 Link

Delete `backend/src/links/product-eoi-config.ts`. Add
`backend/src/links/variant-eoi-config.ts`:
```ts
import { defineLink } from "@medusajs/framework/utils"
import EoiModule from "../modules/expression-of-interest"
import ProductModule from "@medusajs/medusa/product"

// 1:1 writable link, mirrors ticket-product-variant.ts's shape (variant-scoped
// config, deleteCascade so a config row never outlives the variant it belongs to).
export default defineLink(
  EoiModule.linkable.eoiConfiguration,
  { linkable: ProductModule.linkable.productVariant, deleteCascade: true }
)
```

### 1.3 Migration

Generate fresh from the changed model (per Phase 0's data check, drop-and-recreate is
acceptable here):
```
cd backend
npx medusa db:generate expressionOfInterest
```
Review the generated SQL before running it — expect a `drop table eoi_configuration` +
`create table eoi_configuration (... variant_id ...)`, plus the link-sync step replacing
`product_product_expressionofinterest_eoi_configuration` with a new
variant-keyed link table.

Run with the same non-interactive flag used during the original build (this repo's shared
dev DB has pre-existing, unrelated `delivery`/`restaurant` link tables that `db:migrate`
will otherwise interactively prompt to delete — decline, do not touch):
```
npx medusa db:migrate --execute-safe-links
```

- [ ] **Checkpoint:** `eoi_configuration` table has a `variant_id` column, not `product_id`;
  the old product-keyed link table is gone; a new variant-keyed link table exists.

---

## Phase 2 — Workflow steps

`backend/src/workflows/steps/create-eoi-configuration.ts` — change the input type and the
`createEoiConfigurations` call's field from `product_id` to `variant_id`. No other logic
changes (still returns `StepResponse(eoiConfig, eoiConfig.id)` with the same delete-on-rollback
compensation).

`backend/src/workflows/steps/update-eoi-configuration.ts` — no field reference to
`product_id` exists today (it keys off `id` only), so this file needs no change beyond
re-reading it to confirm after Phase 1 lands, per the "re-check don't assume" rule this
repo's build has followed throughout.

- [ ] **Checkpoint:** `npx tsc --noEmit -p tsconfig.json` from `backend/` is clean.

---

## Phase 3 — Upsert workflow

`backend/src/workflows/upsert-eoi-config.ts` — rename input field `product_id` → `variant_id`
throughout:
- The `useQueryGraphStep` query changes from `entity: "product"` /
  `fields: ["id", "eoi_configuration.*"]` to `entity: "product_variant"` /
  `fields: ["id", "eoi_configuration.*"]`.
- The `createRemoteLinkStep` payload changes from
  `{ [Modules.PRODUCT]: { product_id }, [EOI_MODULE]: { eoi_configuration_id } }` to
  `{ [Modules.PRODUCT]: { product_variant_id: variant_id }, [EOI_MODULE]: { eoi_configuration_id } }`
  — confirm the exact linkable key name Medusa generates for `productVariant` (check
  `ticket-product-variant.ts`'s own workflow, if one exists, or inspect
  `ProductModule.linkable.productVariant` at runtime) before writing this; do not guess the
  key name.

- [ ] **Checkpoint:** a standalone `medusa exec` script that calls
  `upsertEoiConfigWorkflow(container).run({ input: { variant_id: "<real variant id>",
  value_type: "fixed", value_amount: 10 } })` succeeds and the row appears in
  `eoi_configuration` with the right `variant_id`.

---

## Phase 4 — Cart-time fetch

`backend/src/workflows/add-to-cart-with-eoi.ts` — the `useQueryGraphStep` fetching the variant
currently asks for `"product.eoi_configuration.*"` (traversing through the product). Change
to fetch the config directly off the variant: `"eoi_configuration.*"`. Everything downstream
(`validateEoiCartItemStep`'s input, the `when(...)` condition checking
`variants[0].product?.eoi_configuration?.status`) updates its property path from
`variants[0].product?.eoi_configuration` to `variants[0].eoi_configuration` — a path change,
not a logic change. `validate-eoi-cart-item.ts` itself needs no change (it already receives
`eoi_configuration` as a plain parameter regardless of how the caller fetched it).

- [ ] **Checkpoint:** adding a variant with its own `eoi_configuration` (fixed, say $15) to a
  cart produces a line item priced at exactly $15, and a sibling variant of the *same
  product* with a different fixed config (say $25) produces a $25 line item — proving the
  fix actually works, not just that nothing broke.

---

## Phase 5 — Admin route + widget

### 5.1 Route

Move `backend/src/api/admin/products/[id]/eoi-config/` to
`backend/src/api/admin/products/[id]/variants/[variant_id]/eoi-config/`:
- `GET` — filter changes from `{ product_id: id }` to `{ variant_id }` (reading the new URL
  param, not the product's `id`).
- `POST` — `upsertEoiConfigWorkflow`'s input changes from `{ product_id: id, ... }` to
  `{ variant_id, ... }`.
- `validators.ts` moves alongside unchanged (the Zod shape itself — `value_type`,
  `value_amount`, `status` — doesn't change, only which id it's scoped by).

Delete the old `backend/src/api/admin/products/[id]/eoi-config/` directory entirely once the
new one is confirmed working — do not leave both reachable.

### 5.2 Widget

`backend/src/admin/widgets/product-eoi-config.tsx` — restructure from a single
summary-card-plus-drawer into a small table:
- Fetch the product's variants (`product.variants.*`) plus each variant's `eoi_configuration.*`
  in one query (the widget already receives the full `AdminProduct` via `DetailWidgetProps`,
  so `product.variants` may already be present without an extra fetch — check the shape
  Medusa's admin SDK actually hands this widget before adding a redundant query).
- Render one row per variant: variant title/SKU, current value type + amount (or "Not
  configured"), an Edit button opening the existing Drawer form scoped to that one variant's
  `variant_id`.
- The Drawer's save button now calls
  `POST /admin/products/:id/variants/:variant_id/eoi-config` instead of the old
  product-scoped route.

- [ ] **Checkpoint:** opening a product with 3 variants shows 3 rows; configuring one
  variant's EOI value does not affect the other two; reload persists all three independently.

---

## Phase 6 — Vendor route + seller UI

### 6.1 Route

Move `backend/src/api/vendors/products/[id]/eoi-config/` to
`backend/src/api/vendors/products/[id]/variants/[variant_id]/eoi-config/`, same GET/POST
shape change as Phase 5.1, still importing the shared validator from its new admin path. The
`assertOwnership(req, id)` call stays as-is — it already checks the **product** id in the
URL, which is still present in the new nested path; a variant doesn't need its own ownership
check (the existing `assertVariantBelongsToProduct` helper in
`src/api/vendors/products/helpers.ts`, used elsewhere for exactly this, should be added here
too so a vendor can't pass their own product id alongside another vendor's variant id).

- [ ] **New rule this phase introduces, not in the original EOI plan:** add
  `assertVariantBelongsToProduct(req, id, variant_id)` as the second line of both handlers,
  after `assertOwnership`. Without it, the ownership gap `sellers/PRODUCTS.md` §6 rule 2
  warns about re-opens: a vendor could pair their own product id with a variant id from
  someone else's product.

### 6.2 Client helpers

`sellers/src/lib/data/vendor-client.ts` — `getVendorEoiConfig` / `upsertVendorEoiConfig`
signatures change from `(productId)` / `(productId, body)` to `(productId, variantId)` /
`(productId, variantId, body)`, URL building updates to the new nested path.

### 6.3 UI

`sellers/src/modules/products/components/detail/eoi-section.tsx` — same table restructure as
Phase 5.2's admin widget: one row per variant (the component already receives the full
`VendorProduct`, confirm `variants` is present on that type before adding a fetch), Edit
drawer scoped per-variant.

- [ ] **Checkpoint:** seller signs in, opens their own product with multiple variants,
  configures two of them differently, reloads, sees both configs persisted independently.
  Then: attempt `GET /vendors/products/<own id>/variants/<another vendor's variant id>/eoi-config`
  directly — confirm **404** (the `assertVariantBelongsToProduct` check from 6.1), not a leak
  of that other vendor's config.

---

## Phase 7 — Full regression pass

- [ ] `npx tsc --noEmit -p tsconfig.json` (backend) — clean
- [ ] `npx tsc --noEmit -p src/admin/tsconfig.json` (backend admin) — clean
- [ ] `npx tsc --noEmit -p tsconfig.json` (sellers) — clean
- [ ] Re-run the full cart → checkout → order flow from the original plan's own testing
  guidance, confirming a `converted` `Eoi` row still gets created correctly with the
  variant-level config now in play
- [ ] Confirm `backend/src/api/store/carts/[id]/line-items/eoi/route.ts` and
  `backend/src/api/store/eois/[cart_id]/route.ts` need **no changes** — they were never
  product-scoped to begin with (already variant/cart-scoped), so this phase should find zero
  diffs there; treat an unexpected diff as a signal something upstream leaked a `product_id`
  assumption that wasn't caught above.

---

## Out of scope for this plan

- Backfilling any existing `eoi_configuration` rows (Phase 0 confirms there are none to
  backfill; if that assumption is wrong when actually run, stop and re-plan this phase).
- Changing `Eoi` (the transactional record) — it already carries `variant_id` and needs no
  change.
- A bulk "set all variants to the same EOI value" convenience action in the UI — each variant
  is configured independently; a bulk-apply shortcut is a reasonable future enhancement, not
  part of this fix.
