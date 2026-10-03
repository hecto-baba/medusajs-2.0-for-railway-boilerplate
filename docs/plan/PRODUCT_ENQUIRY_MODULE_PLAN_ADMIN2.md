# Product Enquiry Module — Admin Addendum: Per-Product Enable + Custom Fields

Addendum to `PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN.md`. Phases 1-6 of that plan are implemented and build-verified (module, links, workflows, email, routes, widget). This addendum covers a gap found after seeing the widget next to Rental/Appointment Configuration on a real product page: **enquiries currently work for every product with no way to turn them off, and collect only a fixed email+message shape.** Both are inconsistent with how Rental and Appointment already work on the same page, and both need to change before this ships.

## What's changing and why

| Gap | Decision |
|---|---|
| Any product can receive an enquiry right now - no per-product toggle | Opt-in per product, exactly like `RentalConfiguration`/Appointment Configuration. Admin clicks "Enable Enquiries" before the storefront can show an "Ask a question" UI or the store route will accept a submission for that product. |
| Only `customer_email` + `message` can be collected | Admin can add custom fields per product: **Text, Long text, Email, Phone (E.164), Number, Dropdown, Radio, Checkbox.** Each field has a label, a required toggle, and (for Dropdown/Radio/Checkbox) an admin-defined option list. |
| No ordering control | Admin can reorder custom fields (drag-to-reorder in the builder); the stored order is what the storefront form and the admin's answer display both use. |
| Phone format | Phone answers must be valid **E.164** (`+` + country code + number, e.g. `+14155552671`) - validated server-side on submission, not just "looks like a phone number." |

## Design: how this is stored (plain JSON, no new mechanism)

Medusa has no dedicated "form builder" primitive. The standard pattern - the same one Medusa core uses for `metadata` - is `model.json()`: one JSON column holding the *schema* (what fields exist), a second JSON column on the answering row holding the *answers*. No new tables needed beyond the configuration row itself.

```ts
// The schema an admin builds, stored on EnquiryConfiguration.custom_fields
type EnquiryFieldType =
  | "text" | "long_text" | "email" | "phone"
  | "number" | "dropdown" | "radio" | "checkbox"

type EnquiryFieldDefinition = {
  id: string                 // stable id, generated once, referenced by answers - never the label
  type: EnquiryFieldType
  label: string
  required: boolean
  order: number               // admin-controlled position; array order in JSON is also respected,
                               // but an explicit field avoids relying on JSON array order surviving
                               // every read/write path
  options?: string[]          // dropdown / radio / checkbox only
}

// What a customer submitted, stored on Enquiry.custom_field_answers
type EnquiryFieldAnswers = Record<string /* field id */, string | string[]>
// string[] only for checkbox (multi-select); every other type is a single string
// (phone stored E.164-normalized, number stored as its string representation)
```

---

## Phase A — Data model changes

### A.1 New model: `EnquiryConfiguration`
New file: `backend/src/modules/product-enquiry/models/enquiry-configuration.ts`

```ts
import { model } from "@medusajs/framework/utils"

const EnquiryConfiguration = model.define("enquiry_configuration", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  status: model.enum(["active", "inactive"]).default("inactive"),
  custom_fields: model.json().nullable(), // EnquiryFieldDefinition[] - see Design section
})

export default EnquiryConfiguration
```

- [ ] `status` defaults to `"inactive"` - a product is not enquirable until an admin explicitly enables it, mirroring `RentalConfiguration`'s `status` field and "Make Bookable" flow
- [ ] One `EnquiryConfiguration` row per product (1:1, like `RentalConfiguration`) - created on first "Enable Enquiries", updated on every subsequent field-builder save

### A.2 Extend `Enquiry` model
File: `backend/src/modules/product-enquiry/models/enquiry.ts`

- [ ] Add `custom_field_answers: model.json().nullable()` - the customer's answers, keyed by `field.id` from the configuration that was active at submission time
- [ ] No other changes to this model

### A.3 Register the new model in the service
File: `backend/src/modules/product-enquiry/service.ts`

- [ ] Add `EnquiryConfiguration` to the `MedusaService({ Enquiry, EnquiryConfiguration })` call - auto-generates `createEnquiryConfigurations`, `retrieveEnquiryConfiguration`, `updateEnquiryConfigurations`, etc.

### A.4 New link: Product ↔ EnquiryConfiguration
New file: `backend/src/links/product-enquiry-config.ts`

```ts
import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import ProductEnquiryModule from "../modules/product-enquiry"

// 1:1, not isList - mirrors product-rental-config.ts exactly.
export default defineLink(
  ProductModule.linkable.product,
  ProductEnquiryModule.linkable.enquiryConfiguration
)
```

### A.5 Migration
- [ ] `npx medusa db:generate productEnquiry` - review the generated SQL by hand (new `enquiry_configuration` table + new nullable `custom_field_answers` column on `enquiry`; nothing dropped, nothing renamed)
- [ ] `npx medusa db:migrate` for the table/column
- [ ] `npx medusa db:sync-links --execute-safe` for the new link - **use `--execute-safe`, not the interactive prompt**: this repo has pre-existing unrelated stale link tables (`delivery`/`restaurant`, leftover from the original template) that the interactive prompt offers to delete. `--execute-safe` applies only the new, safe (additive) link and leaves everything else untouched, exactly as done for Phase 2 of the base plan.

---

## Phase B — E.164 phone validation

No existing phone-format validation anywhere in this codebase (confirmed via search - existing `phone` fields on customers/addresses are plain unvalidated `z.string()`). This is new.

New file: `backend/src/utils/validate-e164-phone.ts`

- [ ] A single exported function, `isValidE164(value: string): boolean`, using the regex `^\+[1-9]\d{1,14}$` (the E.164 spec: leading `+`, no leading zero, 2-15 digits total) - sufficient for format validation without a runtime dependency
- [ ] Used in Phase C's zod schema for the store submission route (`z.string().refine(isValidE164, "Phone must be in E.164 format, e.g. +14155552671")`) for every `phone`-type custom field answer
- [ ] Note for the storefront (out of scope here, flagged for the future storefront-integration plan): a plain text input asking users to type `+14155552671` themselves is a poor UX. A country-code-aware input component (e.g. built on `libphonenumber-js`, which normalizes to E.164 automatically) belongs on the storefront form, not the backend - the backend's job is only to validate/reject bad input, not to help format it.

---

## Phase C — Workflows

### C.1 `upsertEnquiryConfigWorkflow`
New files: `backend/src/workflows/upsert-enquiry-config.ts`, steps `create-enquiry-configuration.ts` / `update-enquiry-configuration.ts`

- [ ] Mirrors `upsert-rental-config.ts`'s create-or-update-by-product_id shape exactly (`useQueryGraphStep` to check for an existing config via the product link, `when(...).then(...)` for the create branch, plain step call for the update branch)
- [ ] Input: `product_id`, `status?`, `custom_fields?` (full replacement array - the admin's builder always sends the complete field list on save, not a diff)
- [ ] Validation before saving: every `custom_fields[].id` is unique; every `dropdown`/`radio`/`checkbox` field has at least one non-empty option; reject with `MedusaError.Types.INVALID_DATA` otherwise

### C.2 Extend `createEnquiryWorkflow`
File: `backend/src/workflows/create-enquiry.ts` (already implemented - this phase extends it)

- [ ] Add a step before `createEnquiryStep` that loads the product's `EnquiryConfiguration` via `useQueryGraphStep` (fields: `["id", "status", "custom_fields"]`, filter by `product_id`)
- [ ] If no configuration exists, or `status !== "active"`, throw `MedusaError.Types.NOT_ALLOWED` ("This product is not currently accepting enquiries.") - this is the actual enforcement point for "opt-in per product"
- [ ] If active, validate `input.custom_field_answers` against the configuration's `custom_fields`: every `required: true` field has a non-empty answer; every `dropdown`/`radio` answer is one of that field's `options`; every `checkbox` answer is a subset of `options`; every `phone` answer passes `isValidE164` (Phase B) - collect all violations and throw one `MedusaError.Types.INVALID_DATA` listing them, rather than failing on the first
- [ ] Pass validated `custom_field_answers` through to `createEnquiryStep`

### C.3 Extend `createEnquiryStep`
File: `backend/src/workflows/steps/create-enquiry.ts` (already implemented)

- [ ] Accept and persist `custom_field_answers` on the created row
- [ ] Compensation (delete-on-failure) already covers this - no change needed there

---

## Phase D — API routes

### D.1 Admin config route (mirrors `rental-config`)
New file: `backend/src/api/admin/products/[id]/enquiry-config/route.ts`

- [ ] `GET` - returns the product's `EnquiryConfiguration` (or `null` if never configured, same as `rental-config`'s `rental_configs[0]`)
- [ ] `POST` - zod body: `status: z.enum(["active","inactive"]).optional()`, `custom_fields: z.array(EnquiryFieldDefinitionSchema).optional()` (a zod schema mirroring the `EnquiryFieldDefinition` type from the Design section, with a `.refine()` enforcing unique `id`s and non-empty `options` on choice-type fields - same validation as C.1, kept in the route schema too so bad requests are rejected before the workflow runs, not just inside it)
- [ ] Runs `upsertEnquiryConfigWorkflow`

### D.2 Store submission route
File: `backend/src/api/store/enquiries/route.ts` (already implemented - this phase extends its schema)

- [ ] Extend `PostStoreEnquirySchema` to accept `custom_field_answers: z.record(z.union([z.string(), z.array(z.string())])).optional()`
- [ ] Pass through to `createEnquiryWorkflow` unchanged - the workflow (C.2) is the source of truth for validating answers against the active configuration, since the route has no way to know a product's field schema without querying it, which the workflow already does

### D.3 Middleware wiring
File: `backend/src/api/middlewares.ts`

- [ ] Add matcher `/admin/products/:id/enquiry-config`, method `POST`, `validateAndTransformBody(PostEnquiryConfigBodySchema)`
- [ ] Update the existing `/store/enquiries` matcher's body schema import to the extended `PostStoreEnquirySchema` (same schema, extra optional field - no new matcher entry needed)

---

## Phase E — Admin widget: one widget, two states

File: `backend/src/admin/widgets/product-enquiries.tsx` (already implemented - this phase significantly extends it, following the user's explicit direction: **one widget, two states**, matching how `product-rental-config.tsx` itself shows "Make Rentable" when unconfigured and the full config + list when active)

### E.1 Disabled state
- [ ] When `GET /admin/products/:id/enquiry-config` returns no config or `status: "inactive"`: show the same "not currently accepting enquiries" empty-state copy Rental uses, with an **"Enable Enquiries"** button
- [ ] Clicking it opens the field-builder Drawer (E.3) rather than immediately activating with zero fields - an admin should set up (or explicitly accept the email+message-only default) before customers can submit

### E.2 Enabled state
- [ ] Show the existing enquiry list (already built) plus a small header row with the Active badge (mirrors Rental's badge) and an "Edit fields" action opening the same Drawer as E.1, pre-filled
- [ ] Each enquiry row, when opened, now also renders `custom_field_answers` below the fixed message - labeled using the field definitions from the *configuration version active when that enquiry was submitted*. Since `custom_fields` on the configuration can change over time (admin edits it later), the enquiry's answers should be paired with the field labels/types captured at submission - see open question below on whether to snapshot the field schema onto the Enquiry row itself or resolve labels live against the current configuration (which breaks if a field was since removed/renamed)

### E.3 Field builder Drawer
New component, likely `backend/src/admin/components/enquiry-field-builder.tsx` given its size (mirrors how appointment-booking's widget already extracts modals into `backend/src/admin/components/`)

- [ ] A list of field rows, each: type selector (the 8 types), label input, required `Switch`, and for choice types an inline option-list editor (add/remove/reorder option strings)
- [ ] **Drag-to-reorder** across the whole field list (this repo already depends on `@dnd-kit/core`/`@dnd-kit/sortable`/`@dnd-kit/utilities` - reuse those rather than adding a new drag library; check `sellers/src/modules/layout/layout-composer/` or the seller product form for this project's existing dnd-kit usage pattern before writing new code)
- [ ] "Add field" button appending a new row with a generated `id` (e.g. `crypto.randomUUID()`) and the next `order` value
- [ ] Save button runs the `POST /admin/products/:id/enquiry-config` mutation with `status: "active"` (first enable) or the current status (subsequent edits) and the full `custom_fields` array
- [ ] Client-side validation before submit mirrors C.1/D.1: unique labels (not required by the schema, but a UX nicety to warn on), non-empty option lists on choice fields, at least a warning if zero fields are defined (empty is valid - email+message only - but worth a confirm-are-you-sure per this codebase's `usePrompt` pattern, matching how Rental confirms on unit changes)

---

## Phase F — Testing checklist

- [ ] A product with no `EnquiryConfiguration` row: `POST /store/enquiries` returns `NOT_ALLOWED`, not a generic 500
- [ ] "Enable Enquiries" with zero custom fields: submission with just email+message succeeds
- [ ] A dropdown field marked required: submission missing that answer is rejected with a clear message naming the field
- [ ] A phone field: `+14155552671` accepted; `4155552671` (no leading `+`) and `+1 415 555 2671` (spaces) both rejected
- [ ] A checkbox field: submitting an answer not present in `options` is rejected
- [ ] Reordering fields in the builder and saving persists the new order; the storefront (once built) and the admin's answer display both reflect it
- [ ] Editing `custom_fields` after enquiries already exist under the old schema does not crash the admin widget when viewing those older enquiries (see open question below - this needs a decision before Phase E.2 is finalized)
- [ ] Disabling an already-active configuration (`status: "inactive"`) blocks new submissions but existing enquiries remain visible/answerable in the widget

---

## Open question - needs a decision before Phase E.2 is built

**Should an `Enquiry` snapshot the field labels/types it was submitted against, or always resolve them live against the product's current `EnquiryConfiguration`?**

- **Snapshot** (safer): copy the relevant `EnquiryFieldDefinition`s onto the `Enquiry` row (or into `custom_field_answers` itself, paired with their definitions) at submission time. An admin later renaming/removing a field never breaks the display of past enquiries. Slightly more storage, slightly more code at submission time.
- **Live resolve** (simpler): always look up the field's current label/type from `EnquiryConfiguration.custom_fields` by id when displaying. Less code, but a renamed field changes how old enquiries are labeled retroactively, and a *removed* field leaves an orphaned answer with no label to show at all.

Recommend **snapshot** for the same reason `Rental` snapshots `rental_unit`/`rental_units_count` rather than resolving them live against a `RentalConfiguration` that can change later (see `RENTAL_MODULE_PLAN_ADMIN.md` 1.2: "snapshot of the unit at booking time (config can change later; the booking record shouldn't)"). This is not yet confirmed with the user - flag it before implementing Phase E.2's answer-label rendering.

---

## Explicitly out of scope for this addendum

- Storefront "Ask a question" UI and the country-code-aware phone input - separate, later plan, same as the base admin plan's own scoping
- Sellers-panel equivalent of the enable/configure widget - still deferred to `PRODUCT_ENQUIRY_MODULE_PLAN_SELLERS.md`, per the original instruction to build admin first
- Conditional fields (e.g. "show field B only if field A = X") - not requested, meaningfully bigger scope, flagged only in case it comes up later
- Per-field validation beyond required/E.164/option-membership (e.g. min/max length on text, regex patterns) - not requested
