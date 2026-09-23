# Products in the Vendor Panel

How the products section is built, end to end, and why it is shaped the way it
is. Read `README.md` first for auth, ports and CORS - this document assumes a
vendor is already signed in.

The short version: **the backend routes are new, almost everything underneath
them is Medusa's.** A vendor product route is a thin scoping wrapper around a
core workflow. The only genuinely new logic is "which rows is this vendor
allowed to touch".

---

## 1. What makes a product belong to a vendor

A link table row. That is the entire ownership model.

```
auth identity  (actor type "vendor", emailpass)
  └─ app_metadata.vendor_id = vendor_admin.id   ← written by setAuthAppMetadataStep
       └─ vendor_admin.vendor_id  (FK)
            └─ vendor  ⇄  product                ← the link table
```

`backend/src/links/vendor-product.ts` defines the last hop:

```ts
export default defineLink(
  { linkable: MarketplaceModule.linkable.vendor, deleteCascade: true },
  { linkable: ProductModule.linkable.product.id, isList: true }
)
```

`isList` because a vendor sells many products. `deleteCascade` drops the link
rows with the vendor; the products themselves belong to the Product module and
survive.

Two things this is deliberately **not**:

- **Not a column on the product.** Medusa's Product module is core and is not
  modified. Ownership lives beside it, in the marketplace module's link.
- **Not a sales channel.** Every vendor product is forced into the store's
  single default channel (see §3). Sales channels carry no isolation at all.

The practical consequence: **isolation is enforced per-route, in application
code.** There is no database constraint and no middleware that does it for you.
A route that forgets the check is a cross-tenant leak, and nothing else will
catch it. §6 is therefore not optional reading.

---

## 2. Request path

Nothing in the browser talks to the backend directly.

```
client component
  → /api/vendors/<path>           Next route handler, same origin
      → Bearer <httpOnly cookie>  attached server-side
      → :9000/vendors/<path>      Medusa
```

`sellers/src/app/api/vendors/[...path]/route.ts` is that proxy. It exists for
two reasons, either of which alone would justify it:

- The session token is in an **httpOnly cookie**, so client JS cannot read it
  and cannot attach it. The proxy adds the header on the server.
- Medusa applies CORS to `/admin`, `/store` and `/auth` **only**. A browser
  calling `/vendors/*` cross-origin is blocked, and there is no setting that
  would allow it. Same-origin sidesteps the question.

It forwards status and body verbatim so the client sees real backend errors,
and streams non-JSON bodies as `arrayBuffer()` so multipart uploads survive.

Server-rendered reads (session, profile) skip the proxy and use the Medusa JS
SDK directly in server actions - `src/lib/data/vendor.ts`. Client reads go
through `src/lib/data/vendor-client.ts`, a typed `fetch` wrapper over the proxy.

---

## 3. Creating a product

`POST /vendors/products` → `createVendorProductWorkflow`
(`backend/src/workflows/create-vendor-product.ts`).

The workflow composes Medusa's own `createProductsWorkflow` and then writes the
ownership link:

```ts
createProductsWorkflow.runAsStep({ input: productData })
// ...then, for each created product:
createRemoteLinkStep([{
  [MARKETPLACE_MODULE]: { vendor_id },
  [Modules.PRODUCT]:    { product_id },
}])
```

**The link step is the whole point.** A product created without it exists, is
visible in the Medusa admin, and is invisible to its own vendor forever - no
ownership check will ever pass for it. This is exactly the CSV-import bug in §7.

The workflow also forces the product into the store's default sales channel. A
vendor has no way to pick one, and a product in no channel is invisible to the
storefront.

`vendor_admin_id` comes from `req.auth_context.actor_id` - the verified token -
never from the request body.

---

## 4. Backend routes

All under `backend/src/api/vendors/products/`.

| Route | Purpose |
| --- | --- |
| `GET,POST /` | list (paginated, filtered), create |
| `GET,POST,DELETE /:id` | detail, update, delete |
| `POST /batch` | bulk create/update/delete |
| `POST /export` | CSV export, emailed when ready |
| `POST /imports`, `/imports/:tx/confirm` | two-step CSV import |
| `POST /import*` | legacy alias - re-exports the above |
| `/:id/options`, `/options/batch` | product options |
| `/:id/variants`, `/variants/batch`, `/:variant_id` | variants |
| `/:id/variants/:variant_id/inventory-items[/:item_id]` | inventory links |
| `/:id/variants/:variant_id/images/batch` | variant images |
| `/:id/images/:image_id/variants/batch` | image → variant assignment |
| `/:id/rental-config` | rental settings (custom module) |

Supporting: `/vendors/uploads` (media + CSV), `/vendors/taxonomy` (pickers).

### New vs reused

Only the route file is new. Inside it:

- **Validators are imported from admin** - `AdminCreateProduct`,
  `AdminUpdateProduct`, `createBatchBody(...)` from
  `@medusajs/medusa/api/admin/products/validators`. The two panels cannot drift
  apart on request shape, because they share the schema.
- **Workflows are Medusa's** - `updateProductsWorkflow`,
  `deleteProductsWorkflow`, `exportProductsWorkflow`,
  `importProductsAsChunksWorkflow`, `updateLinksWorkflow`.

So a handler is usually three lines, one of which is ours:

```ts
await assertOwnership(req, id)                          // ours
await updateProductsWorkflow(req.scope).run({           // Medusa
  input: { selector: { id }, update: req.validatedBody },// admin validator
})
```

The legacy import path does not even duplicate a handler - it re-exports:
`export { POST } from "../imports/route"`, so both spellings share one
implementation *including its ownership checks*.

### Why not just proxy to `/admin/*`

Admin routes have no concept of a vendor. `GET /admin/products` returns the
whole store, there is no hook to constrain it, and the auth actor type differs
(`vendor` vs `user`). Forwarding would leak the entire catalogue.

---

## 5. Middleware

One file: `backend/src/api/middlewares.ts`.

```ts
{ matcher: "/vendors/*", middlewares: [authenticate("vendor", ["session","bearer"])] }
```

`POST /vendors` is the exception - it runs with `allowUnregistered: true`,
because the token from `/auth/vendor/emailpass/register` has an auth identity
but no vendor behind it yet. The route itself rejects tokens that already carry
an `actor_id`, so it cannot be used to register twice.

Two things worth knowing:

**List routes need `validateAndTransformQuery` or pagination silently breaks.**
The handlers read `limit`/`offset` off `validatedQuery`; with no entry that
object is never populated and every request returns the schema defaults.

**`/vendors/*` is a prefix match, not a single segment.** Medusa passes matchers
straight to Express (`app.use(route.matcher, ...)`), so Express 4
`path-to-regexp` semantics apply and `/vendors/*` covers the whole subtree,
nested paths included. The extra `/vendors/products/:id/*` entry is harmless
redundancy, and the in-code comment claiming single-segment matching is wrong.

> This is version-sensitive. **Express 5 changes bare `*`** to a named/invalid
> wildcard, which would turn that comment's assumption into a real auth hole on
> upgrade. Keep Express pinned to 4, or rewrite the matchers as `/vendors/(.*)`
> before upgrading.

---

## 6. Isolation - the part that must not be skipped

`authenticate("vendor")` proves the caller is **a** vendor. It says nothing
about whether *this* product is theirs. That second question is answered only by
the helpers in `backend/src/api/vendors/products/helpers.ts`:

| Helper | Guards |
| --- | --- |
| `assertOwnership(req, productId)` | the product id in the URL |
| `assertVariantBelongsToProduct` | a variant id in the URL |
| `assertVariantIdsBelongToProduct` | variant ids in a **request body** |
| `assertImageIdsBelongToProduct` | image ids in URL or body |
| `getVendorId(req)` | resolves the vendor for routes creating new rows |

Rules the existing routes follow, and new ones must:

1. **Scope on `actor_id`, never on a request field.** Accepting a vendor id from
   the caller would let anyone read any catalogue.
2. **Check body ids too.** Batch routes take ids in the payload; guarding only
   the URL's product id lets a vendor pair their own product with someone
   else's variant ids and have a core workflow act on rows they do not own.
3. **Short-circuit an empty id list.** An `id: []` filter is treated as *no
   constraint* downstream - list, export and orders would all return or process
   the entire store. Every such route returns early instead.
4. **Answer 404, never 403.** "Exists but not yours" confirms an id belongs to
   someone else; a missing id and a foreign id must be indistinguishable.

Sub-resources (options, images, inventory links) carry no checks of their own -
each hangs off a product, so guarding the parent covers them. The exception is
any id the caller supplies separately, which is what rules 2 covers.

`/vendors/taxonomy` is intentionally **not** scoped: collections, categories,
tags, types, channels and shipping profiles are platform-wide shelving, no
vendor owns them, and Medusa has no vendor link on any of them. It returns ids
and labels only - never the products filed under each - so it cannot be walked
to enumerate another vendor's catalogue. Creating taxonomy is not offered.

---

## 7. Import and export

Both mirror the admin: the work happens in a background workflow and the result
arrives by email.

**Export** builds its filter from the vendor's own product ids rather than
passing `req.filterableFields` through as the admin route does - that alone is
what keeps it from exporting the whole store. Empty catalogue short-circuits.

**Import** is two steps - upload+parse, then confirm - so the vendor sees
create/update counts before anything is written.

The ownership check has to happen **before** the workflow starts. The import
pipeline splits rows into creates (by handle) and updates (by `Product Id`), and
nothing downstream knows about vendors: a row naming another vendor's product id
would update that vendor's product, inside an async step with no request
context. So `imports/route.ts` reads the uploaded CSV back, extracts every
`Product Id`, and runs `assertOwnership` on each before accepting the file. The
CSV scanner **fails closed** - a row that does not parse cleanly is refused
rather than skipped, because a mis-parsed row is exactly how an unchecked id
would slip through.

### Known gaps

- **Imported products are orphaned.** The rows are created by an async chunk
  step with no request context, so no vendor link is written. They exist and
  are visible in the Medusa admin, but never appear in the vendor's list and no
  ownership check passes for them. Closing this needs a `product.created`
  subscriber that reads the import's transaction id and links the rows back.
  Documented in `imports/[transaction_id]/confirm/route.ts`.
- **`transaction_id` is not verified on confirm.** It is caller-supplied and
  unchecked, so a vendor could confirm another vendor's pending import. Low
  severity - the *contents* were already validated against the starter - but the
  fix is cheap: record the vendor id when the import starts and compare here.
- **Uploads are not vendor-scoped.** `/vendors/uploads` records no owner; a file
  becomes "owned" only once its URL is attached to an owned product.

---

## 8. Frontend

```
src/app/(panel)/products/          routes - thin, delegate to modules
  page.tsx                         → <ProductsTable/>
  new/page.tsx                     → <ProductForm/>
  [id]/page.tsx                    → <ProductDetail/>
  [id]/edit/page.tsx               → <ProductEditor/>

src/modules/products/components/
  products-table.tsx               list
  product-form.tsx                 create + edit, one form
  product-export-button.tsx
  product-import-modal.tsx
  detail/                          general, media, options, variants,
                                   metadata, rental, sales-channel, organize
```

**List** - Medusa UI `DataTable` + React Query, `placeholderData: previous` so
paging does not blank the table. Columns mirror the admin: product, collection,
sales channel, variant count, status, created.

Only a **status filter** is offered, deliberately: a type/tag/sales-channel
filter would reveal which taxonomy entries other vendors are using. Keep this
constraint when adding filters.

**Create/edit** - one component, `isEdit = Boolean(product)`. Two input
conventions that matter: `text()` maps `"" → undefined` (omit the field) while
`num()` maps `"" → null` (explicitly unset it). On edit, `handle` is sent only
when changed.

On create it seeds a default option and variant so the product is purchasable
immediately, rather than leaving a product with no variants.

**Detail and editor both fetch client-side** on purpose: a foreign or unknown id
then renders an error state instead of throwing during a server render.

**React Query keys are not namespaced by vendor** (`["vendor-products", ...]`).
That is safe *only* because the `QueryClient` is created inside `useState` in
`query-provider.tsx` - one client per browser, per request. Hoisting it to
module scope would leak one vendor's cache into another's SSR render. Do not
"optimize" it there.

### Known gaps

- `DEFAULT_CURRENCY = "eur"` is hardcoded in `product-form.tsx`; a vendor cannot
  choose a currency on create.
- `/dashboard` still says wiring products and orders is "the next piece of
  work". Both shipped.
- `modules/common/components/form/form.tsx` is unused scaffolding - not exported
  from the barrel.

---

## 9. Adding another feature

The products section is the reference implementation. To port Inventory,
Promotions or Price Lists - all three are already rendered disabled in the
sidebar, pending exactly this:

1. **Link it.** If the entity is not reachable from `Vendor`, add a `defineLink`
   in `backend/src/links/`. No link, no scoping.
2. **Add `backend/src/api/vendors/<feature>/`**, importing the admin validator
   so shapes stay in sync.
3. **Scope reads** through `vendor_admin` → `actor_id`. Short-circuit empty.
4. **Call the ownership guard first** in any handler touching a specific id -
   plus the body-id variants on batch routes.
5. **Wrap creates in a workflow** that writes the link via
   `createRemoteLinkStep`, or the rows are orphaned (§3).
6. **Register middleware**, including `validateAndTransformQuery` on list
   routes (§5).
7. **Add typed helpers** to `vendor-client.ts` (client, via proxy) or
   `vendor.ts` (server, via SDK).
8. **Build UI** under `app/(panel)/` + `modules/`.
9. **Verify:** sign in as vendor A, request a vendor B id directly, expect
   **404**.

Step 4 is the one with teeth. Because the guard is opt-in and per-route, a
forgotten call fails *open*. If several features are being ported, consider
inverting that first - a `withVendorScope(handler)` wrapper, or middleware that
runs `assertOwnership` for any `:id` under `/vendors/products/` - so the default
is closed and an omission is a 404 rather than a leak.
