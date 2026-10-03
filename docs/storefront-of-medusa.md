# Storefront of Medusa: Complete Architecture, Routes & Data Layer Manual

> **Document Status**: Production-Ready Architectural Reference  
> **Framework**: Next.js 15 (App Router with Server Components & Server Actions)  
> **Styling**: Tailwind CSS + Medusa UI Design System  
> **SDK**: `@medusajs/js-sdk`  
> **Local Port**: `8000` (Direct URL: `http://localhost:8000`)

---

## Table of Contents
1. [Architecture & Core Concepts](#1-architecture--core-concepts)
2. [Complete Routing & Page Catalog](#2-complete-routing--page-catalog)
3. [B2B Corporate Suite in Storefront](#3-b2b-corporate-suite-in-storefront)
4. [Restaurants & Food Ordering Experience](#4-restaurants--food-ordering-experience)
5. [Live Delivery Tracking & SSE Integration](#5-live-delivery-tracking--sse-integration)
6. [Digital Products & Instant Library](#6-digital-products--instant-library)
7. [Rentals & Event Ticketing Flows](#7-rentals--event-ticketing-flows)
8. [Core E-Commerce & Checkout Pipeline](#8-core-e-commerce--checkout-pipeline)
9. [Exhaustive Server Actions & Data Layer Catalog](#9-exhaustive-server-actions--data-layer-catalog)
10. [Storefront Environment & Operational Guide](#10-storefront-environment--operational-guide)

---

## 1. Architecture & Core Concepts

### 1.1 Localized Dynamic Routing (`/[countryCode]`)
Every storefront route is strictly localized by a 2-letter ISO country code prefix (e.g., `/gb`, `/us`, `/de`).
- **Middleware Resolution** (`storefront/src/middleware.ts`): Inspects geolocation headers and cookies. If the visitor hits `/`, they are automatically 307-redirected to `/[default_countryCode]` (defaults to `gb`).
- **Region Binding**: The country code dictates currency (`eur`, `gbp`, `usd`), localized pricing, regional tax rates, and applicable shipping methods.

### 1.2 Multi-Tier Caching & Tag Scoping
The storefront uses a deterministic cache invalidation strategy in Next.js:
- **Per-Visitor Cart Scoping**: The shopping cart is cached using a tagged cookie key (`_medusa_cart_id`). Cache tags are invalidated on every add/update/delete mutation via `revalidateTag()`.
- **Server Actions**: All backend writes occur in secure `"use server"` actions (`storefront/src/lib/data/*`), preventing client-side API secret leaks and eliminating CORS issues.

### 1.3 Automatic Key Exchange
On boot, `storefront/check-env-variables.js` and `launcher dev` query `GET http://localhost:9000/key-exchange`. The active publishable API key is resolved dynamically and stored in `_medusa_jwt` cookies and headers, guaranteeing the storefront never starts with missing permissions.

---

## 2. Complete Routing & Page Catalog

| Route Path | Type | Component Source | Primary Data Fetcher |
| :--- | :--- | :--- | :--- |
| `/[countryCode]` | Server | `src/app/[countryCode]/(main)/page.tsx` | `listProducts`, `listCollections` |
| `/[countryCode]/store` | Server | `src/app/[countryCode]/(main)/store/page.tsx` | `listProductsWithSort` |
| `/[countryCode]/products/[handle]` | Server | `src/app/[countryCode]/(main)/products/[handle]/page.tsx` | `getProductByHandle`, `listRegions` |
| `/[countryCode]/categories/[...category]` | Server | `src/app/[countryCode]/(main)/categories/[...category]/page.tsx` | `getCategoryByHandle` |
| `/[countryCode]/collections/[handle]` | Server | `src/app/[countryCode]/(main)/collections/[handle]/page.tsx` | `getCollectionByHandle` |
| `/[countryCode]/cart` | Server | `src/app/[countryCode]/(main)/cart/page.tsx` | `retrieveCart`, `getCustomer` |
| `/[countryCode]/checkout` | Server | `src/app/[countryCode]/(checkout)/checkout/page.tsx` | `retrieveCart`, `listCartPaymentMethods` |
| `/[countryCode]/order/confirmed/[id]` | Server | `src/app/[countryCode]/(main)/order/confirmed/[id]/page.tsx` | `retrieveOrder` |
| `/[countryCode]/account` | Server | `src/app/[countryCode]/(main)/account/@dashboard/page.tsx` | `getCustomer`, `listOrders` |
| `/[countryCode]/account` (Login Slot) | Client | `src/app/[countryCode]/(main)/account/@login/page.tsx` | Unauthenticated Parallel Route Modal/View |
| `/[countryCode]/account/profile` | Server | `src/app/[countryCode]/(main)/account/@dashboard/profile/page.tsx` | `getCustomer` |
| `/[countryCode]/account/addresses` | Server | `src/app/[countryCode]/(main)/account/@dashboard/addresses/page.tsx` | `getCustomer` |
| `/[countryCode]/account/orders` | Server | `src/app/[countryCode]/(main)/account/@dashboard/orders/page.tsx` | `listOrders` |
| `/[countryCode]/account/orders/details/[id]` | Server | `src/app/[countryCode]/(main)/account/@dashboard/orders/details/[id]/page.tsx` | `retrieveOrder` |
| `/[countryCode]/account/company` | Server | `src/app/[countryCode]/(main)/account/@dashboard/company/page.tsx` | `getCustomerCompany` |
| `/[countryCode]/account/quotes` | Server | `src/app/[countryCode]/(main)/account/@dashboard/quotes/page.tsx` | `listCustomerQuotes` |
| `/[countryCode]/account/approvals` | Server | `src/app/[countryCode]/(main)/account/@dashboard/approvals/page.tsx` | `getCompanyApprovals` |
| `/[countryCode]/account/digital-products` | Server | `src/app/[countryCode]/(main)/account/@dashboard/digital-products/page.tsx` | `getCustomerDigitalProducts` |
| `/[countryCode]/restaurants` | Client | `src/app/[countryCode]/(main)/restaurants/page.tsx` | `/restaurants` API query |
| `/[countryCode]/restaurants/[id]` | Client | `src/app/[countryCode]/(main)/restaurants/[id]/page.tsx` | `/restaurants/:id` API query |
| `/[countryCode]/deliveries/[id]` | Client | `src/app/[countryCode]/(main)/deliveries/[id]/page.tsx` | `/deliveries/:id` + SSE stream |
| `/[countryCode]/digital-products` | Server | `src/app/[countryCode]/(main)/digital-products/page.tsx` | `listProducts` (digital tagged) |
| `/[countryCode]/search` | Server | `src/app/[countryCode]/(main)/search/page.tsx` | InstantSearch MeiliSearch |
| `/[countryCode]/results/[query]` | Server | `src/app/[countryCode]/(main)/results/[query]/page.tsx` | Search Results Grid |
| `/[countryCode]/reset-password` | Server | `src/app/[countryCode]/(main)/reset-password/page.tsx` | Customer Password Reset |
| `/api/healthcheck` | Route Handler | `src/app/api/healthcheck/route.ts` | Server Health Status (`{ status: "ok" }`) |

---

## 3. B2B Corporate Suite in Storefront

The storefront exposes an enterprise procurement portal built specifically for wholesale corporate buyers.

```
       [Cart Summary]
              │
   Exceeds Spending Limit?
        ├── YES ──► [Submit for Manager Approval Button] ──► /account/approvals (Manager review)
        └── NO  ──► [Request Custom Quote Button]        ──► /account/quotes    (Negotiate prices)
```

### 3.1 Company Overview & Team Management (`/account/company`)
- **Page File**: `src/app/[countryCode]/(main)/account/@dashboard/company/page.tsx`
- **Data Hook**: `getCustomerCompany()` in `@lib/data/company.ts`
- **Features**:
  - Displays corporate name, business registration, billing address, and default currency.
  - Highlights the employee's role badge (`Corporate Account` vs `Individual Customer Account`).
  - Displays individual employee spending limits (`spending_limit: 5000 EUR`).
  - Lists all coworkers in the organization with their admin statuses.
  - **Manager Action**: Managers (`is_admin: true`) can invite colleagues directly via `addCompanyEmployee()`.

### 3.2 Quote Requests & Price Negotiation (`/account/quotes`)
- **Page File**: `src/app/[countryCode]/(main)/account/@dashboard/quotes/page.tsx`
- **Component**: `QuotesList` (`@modules/account/components/quotes-list/index.tsx`)
- **Lifecycle in UI**:
  1. **Initiation**: From the cart drawer or summary, the buyer clicks **"Request Bulk Quote"** (`RequestQuoteButton`).
  2. **Specification**: Buyer enters target budget, custom freight notes, vehicle requirements, and target unit prices.
  3. **Negotiation Thread**: The merchant responds with counter-offer unit prices and freight quotes.
  4. **Direct Acceptance**: The buyer clicks **"Accept Merchant Offer"**, which triggers `acceptQuote(quoteId)`, converting the agreed pricing into an order lock.
  5. **Messaging**: Built-in instant messaging thread allows back-and-forth negotiation (`sendCustomerQuoteMessage`).

### 3.3 Spending Limit Approvals (`/account/approvals`)
- **Page File**: `src/app/[countryCode]/(main)/account/@dashboard/approvals/page.tsx`
- **Component**: `ApprovalsList` (`@modules/account/components/approvals-list/index.tsx`)
- **Checkout Enforcement**: If a junior buyer's cart total exceeds their assigned `spending_limit`:
  - Standard payment options are disabled.
  - A highlighted blue button **"Submit for Manager Approval"** appears (`B2BApprovalButton`).
  - The cart enters `pending` approval status.
  - The designated Company Manager logs in, opens `/account/approvals`, reviews line items, and clicks **Approve** or **Reject** via `updateApprovalStatus()`.

---

## 4. Restaurants & Food Ordering Experience

### 4.1 Discovery & Menus (`/restaurants` & `/restaurants/:id`)
- **Page Files**:
  - `src/app/[countryCode]/(main)/restaurants/page.tsx`
  - `src/app/[countryCode]/(main)/restaurants/[id]/page.tsx`
- **Features**:
  - **Kitchen Status**: Displays live green `Open Now` or red `Closed` badges based on operating hours.
  - **Full Menu Categorization**: Dissects food products into categories (Appetizers, Mains, Pizzas, Desserts, Beverages).
  - **Variant Modifiers**: Supports dish sizes (e.g., Small, Medium, Large) and ingredient options.
  - **Single-Kitchen Cart Guard**: If a shopper already has food from "Artisan Pizza" in their cart and attempts to add from "Napoli Trattoria", a modal intercepts:
    > *"Your cart contains items from another restaurant. Would you like to clear your cart and start a new order?"*  
    Handled seamlessly via `clearCartAndAdd()` in `@lib/data/cart.ts`.

---

## 5. Live Delivery Tracking & SSE Integration

### 5.1 Real-Time Tracking Page (`/deliveries/:id`)
- **Page File**: `src/app/[countryCode]/(main)/deliveries/[id]/page.tsx`
- **Data Architecture**:
  - **Primary Transport**: `EventSource` connected directly to `http://localhost:9000/deliveries/:id/subscribe`.
  - **Fallback Layer**: 3-second background polling cycle ensuring tracking never freezes on spotty mobile networks.
- **Visual Progress Bar**:
```
[1. Order Placed] ──► [2. Accepted] ──► [3. Preparing] ──► [4. Ready for Pickup] ──► [5. Out for Delivery] ──► [6. Delivered]
```
- **Driver Card**: Shows driver photo, driver name, phone contact link, and estimated delivery ETA.

---

## 6. Digital Products & Instant Library

### 6.1 Catalog & Product Showcase (`/digital-products`)
- **Page File**: `src/app/[countryCode]/(main)/digital-products/page.tsx`
- **Sample Preview**: Product detail page renders a **"Download Free Sample"** button powered by `getDigitalProductPreview()`.
- **Fulfillment Bypass**: When purchasing digital goods, the checkout pipeline detects that items do not require physical shipping and routes the order through `completeCartDigital()` (`POST /store/carts/:id/complete-digital`).

### 6.2 Customer Digital Library (`/account/digital-products`)
- **Page File**: `src/app/[countryCode]/(main)/account/@dashboard/digital-products/page.tsx`
- **Component**: `DigitalProductsList` (`@modules/account/components/digital-products-list/index.tsx`)
- **Download Action**: Clicking **Download** calls `getDigitalMediaDownloadLink(mediaId)`, which verifies order ownership on the backend and immediately streams or redirects to the secure signed object URL.

---

## 7. Rentals & Event Ticketing Flows

### 7.1 Equipment Rentals (`/products/[handle]`)
- **Component**: `ProductActions` (`@modules/products/components/product-actions/index.tsx`)
- **Date Range Picker**: `RentalDatePicker` enables selecting start and return dates.
- **Availability Query**: Dynamically calls `getRentalAvailability()` (`GET /store/products/:id/rental-availability`) to check calendar conflicts, calculate daily rate multipliers, and display required security deposits.
- **Cart Submission**: Submits via `addRentalToCart()`, locking rental dates against duplicate bookings.

### 7.2 Event Ticketing & Seat Selection
- **Availability Matrix**: Queries `getTicketProductAvailability()` for show dates and remaining seat counts.
- **Interactive Seat Map**: Queries `getTicketProductSeats()` (`GET /store/ticket-products/:id/seats`) to render rows (VIP, Premium, Balcony, Standard) and interactive seat selection buttons.
- **Fast-Track Ticket Checkout**: `CheckoutForm` inspects cart line items; if the cart contains only tickets, physical shipping address steps are automatically omitted (`TicketAddresses`).
- **Cart Completion**: Orders complete via `completeCartWithTicketsWorkflow()`, recording permanent seat assignments.

---

## 8. Core E-Commerce & Checkout Pipeline

### 8.1 Shopping Cart Flow (`/cart`)
- Items added through `addToCart()` in `@lib/data/cart.ts`.
- Supports quantity updates, removals, discount codes (`DiscountCode`), gift cards, and taxes.

### 8.2 Multi-Step Checkout (`/checkout`)
The checkout form (`@modules/checkout/templates/checkout-form/index.tsx`) coordinates 4 sequential steps:
1. **Addresses**: Shipping and billing address entry. Automatically pre-fills for logged-in customers.
2. **Delivery Methods**: Populated dynamically via `listCartShippingMethods()`.
3. **Payment**: Supports Stripe Elements (Card, Apple Pay, Google Pay), PayPal, and Manual Payment.
4. **Review & Place Order**: Executes payment authorization and completes order.

---

## 9. Exhaustive Server Actions & Data Layer Catalog

All functions reside under `storefront/src/lib/data/` and execute as Next.js Server Actions:

### 9.1 Cart Actions (`@lib/data/cart.ts`)

| Server Action | HTTP Method | Target Backend Route | Description |
| :--- | :--- | :--- | :--- |
| `retrieveCart()` | `GET` | `/store/carts/:id` | Reads cart with line items and totals |
| `getOrSetCart(countryCode)` | `GET`/`POST` | `/store/carts` | Retrieves existing cart or provisions new one |
| `addToCart({ variantId, quantity })`| `POST` | `/store/carts/:id/line-items`| Adds regular product variant |
| `updateLineItem({ lineId, quantity })`| `POST` | `/store/carts/:id/line-items/:line_id`| Changes item quantity |
| `deleteLineItem(lineId)` | `DELETE` | `/store/carts/:id/line-items/:line_id`| Removes item from cart |
| `setShippingMethod({ cartId, shippingMethodId })`| `POST`| `/store/carts/:id/shipping-methods`| Attaches delivery rate |
| `initiatePaymentSession(cart, data)`| `POST`| `/store/payment-collections` | Creates Stripe/PayPal session |
| `placeOrder()` | `POST` | `/store/carts/:id/complete` | Finalizes order and clears cart cookie |

### 9.2 B2B Actions (`@lib/data/company.ts` & `@lib/data/quotes.ts`)

| Server Action | HTTP Method | Target Backend Route | Description |
| :--- | :--- | :--- | :--- |
| `getCustomerCompany()` | `GET` | `/store/customers/me/company` | Loads corporate profile & spending limit |
| `addCompanyEmployee(payload)` | `POST` | `/store/customers/me/company/employees`| Invites employee to corporate account |
| `getCompanyApprovals()` | `GET` | `/store/approvals` | Manager list of pending purchases |
| `submitCartForApproval(cartId)` | `POST` | `/store/carts/:id/submit-approval`| Submits order over spending limit |
| `updateApprovalStatus(id, status)`| `POST`| `/store/approvals` | Approves or rejects employee order |
| `listCustomerQuotes()` | `GET` | `/store/customers/me/quotes` | Fetches negotiated quotes list |
| `requestQuote(payload)` | `POST` | `/store/customers/me/quotes` | Submits cart for quote negotiation |
| `acceptQuote(quoteId)` | `POST` | `/store/customers/me/quotes/:id/accept`| Accepts merchant counter-offer |
| `rejectQuote(quoteId)` | `POST` | `/store/customers/me/quotes/:id/reject`| Declines quote |
| `sendCustomerQuoteMessage(id, text)`| `POST`| `/store/customers/me/quotes/:id/messages`| Adds message to negotiation thread |

### 9.3 Specialized Commerce Actions

| File | Server Action | Route Called | Description |
| :--- | :--- | :--- | :--- |
| `rentals.ts` | `getRentalAvailability()` | `/store/products/:id/rental-availability` | Checks rental dates & calculates price |
| `rentals.ts` | `addRentalToCart()` | `/store/carts/:id/line-items/rentals` | Adds rental item with date locks |
| `tickets.ts` | `getTicketProductAvailability()`| `/store/ticket-products/:id/availability`| Returns show dates and remaining seats |
| `tickets.ts` | `getTicketProductSeats()` | `/store/ticket-products/:id/seats` | Fetches interactive venue seat map |
| `tickets.ts` | `addTicketsToCart()` | `/store/carts/:id/line-items/tickets` | Reserves seats in cart |
| `digital-products.ts`| `getCustomerDigitalProducts()` | `/store/customers/me/digital-products` | Lists purchased digital products |
| `digital-products.ts`| `getDigitalMediaDownloadLink()`| `.../digital-products/:mediaId/download` | Obtains secure temporary download link |
| `digital-products.ts`| `getDigitalProductPreview()` | `/store/digital-products/:id/preview` | Downloads free watermarked sample |

---

## 10. Storefront Environment & Operational Guide

### 10.1 Environment Variables (`storefront/.env.local`)

```env
# Backend Connection
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_27ab529d35748a0aded8a9d4036d4b39d860a8e0fe9ac579db9fbdd6a38fefa0

# Storefront URLs
NEXT_PUBLIC_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEFAULT_REGION=gb
NEXT_PUBLIC_STORE_NAME=My Store

# Search (MeiliSearch)
NEXT_PUBLIC_SEARCH_ENDPOINT=http://localhost:7700
NEXT_PUBLIC_SEARCH_API_KEY=
NEXT_PUBLIC_INDEX_NAME=products
```

### 10.2 Recommended Dev Server Launch Command
Due to the comprehensive size of the storefront (5,900+ modules compiled on demand for B2B, Restaurants, Rentals, and Ticketing), start Next.js with an expanded Node heap size to ensure smooth operation:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
cd storefront
pnpm dev
```
Accessible at: **`http://localhost:8000`**
