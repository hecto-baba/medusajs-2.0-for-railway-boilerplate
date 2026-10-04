# EOI Variant-Level — Fix & Finish Execution Plan

Scope: close out `docs/plan/EOI_VARIANT_LEVEL_CONFIG_PLAN.md`, which moved
`EoiConfiguration` from product-scoped to variant-scoped and is **already built,
migrated, and live in the database** — but has 5 confirmed outstanding defects and
no real UI-level verification yet. This plan fixes all 5 and proves the feature
actually works end to end, not just via API/script checks.

Decision going in (confirmed with user): **stay on variant-level**, do not revert to
product-level. The backend (model, migration, links, cart pricing) is already
variant-scoped and live; reverting would undo working, migrated backend work to
chase a UI bug that has a known, understood fix.

---

## The 5 confirmed defects, in execution order

### 1. Admin widget shows "no variants" on every product (blocking, fix first)

**Root cause, confirmed directly against Medusa's compiled source:** the widget
queries `GET /admin/product-variants?product_id=<id>`, but that route's query
validator (`AdminGetProductVariantsParamsFields`) does not include `product_id` as
an allowed filter — only `q`, `id`, `sku`, `ean`, `upc`, `barcode`,
`manage_inventory`, `allow_backorder`. Unknown query params are silently stripped,
so the filter never applies and the widget's fetch is effectively broken.

**Fix:** switch to `GET /admin/products/:id/variants` instead — confirmed real,
existing core Medusa route whose handler builds its filter as
`{ ...req.filterableFields, product_id: productId }` using the **URL path param**,
which cannot be stripped. Verified this route accepts an arbitrary `fields` array
via `req.queryConfig.fields`, so `eoi_configuration.*` will resolve correctly.

**File:** `backend/src/admin/widgets/product-eoi-config.tsx` — change the `useQuery`
from `/admin/product-variants` (with `product_id` as a query param) to
`/admin/products/${product.id}/variants` (product id in the path).

### 2. Admin widget silently reactivates a deactivated config

**Root cause, confirmed by reading the code:** `handleSubmit` always sends
`status: "active"` regardless of the variant's current status:
```ts
config: { value_type: valueType, value_amount: valueAmount, status: "active" }
```
So editing just the amount on a deactivated variant silently re-activates it.

**Fix:** send the variant's existing status (or omit it, letting the backend keep
whatever is already stored), the same way the seller-side `eoi-section.tsx`
already does correctly (`status: editingConfig?.status ?? "active"`).

**File:** `backend/src/admin/widgets/product-eoi-config.tsx`, `handleSubmit`.

### 3. Race condition — duplicate config rows possible under concurrent requests

**Root cause, confirmed live against the database:** `eoi_configuration` has no
unique constraint on `variant_id` (only a primary key on `id`), and
`upsertEoiConfigWorkflow` is a read-then-branch-then-write with no lock between the
read and the write. Two near-simultaneous POSTs to the same variant's config
endpoint can both see "no config exists" and both create a row.

**Fix, two parts (defense in depth, not either/or):**
- **Database:** new migration adding a unique constraint on
  `eoi_configuration.variant_id` (partial, `where deleted_at is null`, matching the
  soft-delete convention already used by this table's own `deleted_at` index). This
  is the real guarantee — it makes a duplicate physically impossible, not just
  unlikely.
- **Application:** wrap `upsertEoiConfigWorkflow`'s read-then-write in
  `acquireLockStep`/`releaseLockStep` keyed on `variant_id`, the same pattern
  `add-to-cart-with-eoi.ts` already uses for its own cart mutation. This avoids the
  workflow throwing a raw DB constraint-violation error to the caller in the normal
  concurrent-click case; the DB constraint remains the backstop for anything the
  lock doesn't catch (e.g. a process crash mid-lock).

**Files:**
- New migration: `backend/src/modules/expression-of-interest/migrations/Migration<timestamp>.ts`
- `backend/src/workflows/upsert-eoi-config.ts` — add lock/release around the
  existing read-then-branch logic.

### 4. N+1 — seller UI fires one request per variant

**Root cause, confirmed by reading the code:** `eoi-section.tsx` uses `useQueries`
to fire one `getVendorEoiConfig(product.id, variant.id)` call per variant, instead
of fetching all variants' configs in one request the way the admin widget (after
fix #1) does.

**Fix:** widen the existing vendor route
`backend/src/api/vendors/products/[id]/variants/route.ts`'s fixed field list to
include `eoi_configuration.*` (it's already an explicit allowlist, a one-line
addition), then rewrite `eoi-section.tsx` to read configs off that single
`listVendorVariants` response instead of firing N parallel requests — deletes the
`useQueries`/`configByVariantId`/`configsLoading` machinery entirely.

**Files:**
- `backend/src/api/vendors/products/[id]/variants/route.ts` — add
  `eoi_configuration.*` to the fields list.
- `sellers/src/lib/data/vendor-client.ts` — extend `VendorVariant`'s type (or the
  list response type) to carry `eoi_configuration`.
- `sellers/src/modules/products/components/detail/eoi-section.tsx` — remove
  `useQueries`, read `eoi_configuration` directly off each variant.

### 5. Admin route missing the ownership/variant-belongs-to-product check

**Root cause, confirmed by reading the code:** the vendor route
(`vendors/products/[id]/variants/[variant_id]/eoi-config/route.ts`) correctly calls
`assertOwnership` + `assertVariantBelongsToProduct`; the admin route
(`admin/products/[id]/variants/[variant_id]/eoi-config/route.ts`) never checks that
`variant_id` actually belongs to `id` — it operates on `variant_id` alone, with the
product id in the URL effectively decorative.

**Fix:** add the equivalent check. Since this is the **admin** surface (trusted
staff, not cross-tenant), this is a correctness guard against URL-building bugs,
not primarily a security boundary — but it should still fail loudly (404) rather
than silently operate on a mismatched pair. Use the same `variant.product_id ===
id` check pattern `assertVariantBelongsToProduct` uses, inlined or via a shared
admin-side helper if one exists; if not, a 5-line inline check is sufficient here
(no need to build a new shared helper for a single call site).

**File:** `backend/src/api/admin/products/[id]/variants/[variant_id]/eoi-config/route.ts`.

---

## Execution order and checkpoints

Fixing in this order because #1 blocks actually seeing the UI at all, and #3 is a
data-integrity issue (should land before more config writes accumulate):

1. **Fix #1** (admin widget route) → typecheck → manually verify in a running admin
   instance that the Sweatpants product now shows its 4 variants.
2. **Fix #3** (race condition: migration + lock) → run migration against dev DB →
   verify via a concurrent-request test script that duplicate creation is now
   blocked, not silently allowed.
3. **Fix #2** (status-clobber) → typecheck → verify: configure a variant, deactivate
   it, edit only the amount, confirm status stays inactive after save.
4. **Fix #5** (admin ownership check) → typecheck → verify: call the admin route
   with a mismatched product/variant pair, confirm 404.
5. **Fix #4** (N+1) → typecheck → verify seller UI network tab shows 1 request for
   variants instead of N.
6. **Full regression pass:**
   - `npx tsc --noEmit` clean across backend, backend-admin, sellers (all three,
     not just backend as has happened before).
   - Re-run the full cart → add-to-cart-with-eoi → checkout → order flow once,
     end to end, confirming nothing in fixes #1-#5 broke the already-working
     cart/order mechanics.
   - **New this pass, not done before:** actually open the admin UI in a browser
     (or have the user do it) and click through — configure a variant, see it
     persist, toggle status, confirm the table renders correctly. Every previous
     "verification" in this feature's build was API/script-level only; this is the
     first real UI-level check.

## Explicitly not in this plan

- The orphaned product-scoped link table
  (`product_product_expressionofinterest_eoi_configuration`) flagged earlier — still
  needs explicit user sign-off before dropping, unrelated to these 5 fixes.
- Storefront customer-facing UI — still doesn't exist, still out of scope here.
- Remaining-balance collection — still deliberately deferred per the original plan.
