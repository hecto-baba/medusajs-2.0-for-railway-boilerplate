# Learning Log — medusajs-2.0-for-railway-boilerplate

## Vendor Onboarding Gatekeeper & Admin Approval State Machine — 2026-09-17

**What was used:** Persistent multi-stage onboarding store (`onboardingStore`) on Medusa backend combined with client-side route gatekeeping in `PanelShell` and `Sidebar`.
**Why this over alternatives:** Strictly gating non-approved vendors at the shell level ensures no sensitive commercial tools (catalog, orders, inventory, pricing) are exposed before compliance review, while centralizing approval/rejection state transitions in Medusa prevents silent auto-approvals.
**Alternatives considered:** Permissive open access with warning banners only; rejected because vendors must complete verification before gaining marketplace merchant privileges.
**Core concept to remember:** Vendor lifecycle must follow a strict state machine: `DRAFT` → `UNDER_REVIEW` → (`APPROVED` | `REJECTED`). Newly registered vendors are kept strictly on `/onboarding` until an admin explicitly audits and approves the application from `/admin/vendor-applications`.

## Vendor 360° Admin Integration (Medusa 2.0 Query Graph & Tabbed UI) — 2026-09-14

**What was used:** Medusa 2.0 `query.graph` multi-entity scoping on backend, combined with `@medusajs/ui` Tabs & DataTable components in admin UI.
**Why this over alternatives:** Querying the graph allows deep cross-module relational querying (products, collections, categories, inventory, orders, customer links, price lists, promotions, venues, shows) in a single structured response, while `@medusajs/ui` Tabs provide native design consistency matching Medusa Admin standards.
**Alternatives considered:** Fetching data via 8 separate client-side API requests; rejected because it creates multiple round trips and loading waterfalls instead of instant tab navigation.
**Core concept to remember:** Medusa 2.0 uses Remote Links to bind custom module data (like Marketplace vendors) to core commerce modules (Products, Inventory, Orders). `query.graph` resolves across these link boundaries seamlessly in unified DML queries.

## Inventory & Reservations 100% Medusa Admin Alignment — 2026-09-15

**What was used:** Medusa UI `<Container className="divide-y p-0">`, `useDataTable`, `ActionMenu`, `SectionRow`, and Two-Column detail layouts matching `@medusajs/dashboard` 1:1.
**Why this over alternatives:** Strictly conforming to the official `@medusajs/dashboard` layout, text copy, column definitions, and confirmation dialogs ensures the Seller Panel behaves identically to Medusa Admin, eliminating cognitive load and UI inconsistencies for vendors and admins.
**Alternatives considered:** Custom dashboard cards and custom modal layouts; rejected in favor of Medusa Admin standard drawers, attribute grids, and table actions.
**Core concept to remember:** In Medusa 2.0, Inventory Items are distinct from Product Variants and are linked to Stock Locations via Inventory Levels (`inventory_levels`). Reservations allocate a specific portion of the stocked quantity at a location, leaving `available = stocked - reserved`. All UI copy and operations strictly reflect this exact tripartite model (`stocked`, `reserved`, `available`).

