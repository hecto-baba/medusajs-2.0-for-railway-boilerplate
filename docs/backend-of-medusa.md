# Backend of Medusa: Complete API & CRUD Reference Manual

> **Document Status**: Production-Ready Architectural Reference  
> **Target Audience**: Mobile App Developers, Frontend Engineers, Backend Integrators  
> **Medusa Version**: Medusa 2.19.0+ Modular Monolith  
> **Base URL (Local)**: `http://localhost:9000`  
> **Railway Production**: Derived automatically from `RAILWAY_PUBLIC_DOMAIN_VALUE`

---

## Table of Contents
1. [Architecture & Universal Conventions](#1-architecture--universal-conventions)
2. [B2B Commerce Suite (Companies, Employees, Quotes, Approvals)](#2-b2b-commerce-suite)
3. [Restaurants & Food Ordering](#3-restaurants--food-ordering)
4. [Deliveries, Drivers & Real-Time Tracking](#4-deliveries-drivers--real-time-tracking)
5. [Digital Products & Media Licensing](#5-digital-products--media-licensing)
6. [Rentals & Event Ticketing Engine](#6-rentals--event-ticketing-engine)
7. [Marketplace Vendor / Seller APIs (35+ Modules)](#7-marketplace-vendor--seller-apis)
8. [Transaction Types & Ledger System](#8-transaction-types--ledger-system)
9. [Core Shopper & Commerce APIs](#9-core-shopper--commerce-apis)
10. [Exhaustive Health & Readiness Matrix](#10-exhaustive-health--readiness-matrix)

---

## 1. Architecture & Universal Conventions

### 1.1 Actor Types & Authentication Schemes
Medusa 2.0 strictly partitions authentication identities by **Actor Type**. Your app must send the correct credentials depending on who is calling the endpoint:

| Actor Type | Primary Scope | Authentication Header | Cookie Fallback |
| :--- | :--- | :--- | :--- |
| **`customer`** | Shoppers, B2B Employees | `Authorization: Bearer <jwt>` | `_medusa_jwt` |
| **`vendor`** | Marketplace Sellers | `Authorization: Bearer <jwt>` | `_medusa_vendor_jwt` |
| **`user`** | Superadmins, Store Staff | `Authorization: Bearer <jwt>` or `x-medusa-access-token` | `connect.sid` session |
| **`driver`** | Delivery Drivers | `Authorization: Bearer <jwt>` | Bearer token |
| **Public / Guest** | Anonymous Shoppers | `x-publishable-api-key: <token>` | None |

### 1.2 Required Headers
- **`Content-Type: application/json`**: Required on all `POST`, `PUT`, and `PATCH` requests.
- **`x-publishable-api-key`**: Required on all `/store/*` and `/key-exchange` endpoints. Fetched dynamically from `GET /key-exchange` if not bundled with the mobile client.
- **`Accept: application/json`**: Required on all data requests.

---

## 2. B2B Commerce Suite

The B2B module powers corporate accounts, multi-employee buyer teams, spending limits, quote negotiations, and approval workflows.

### 2.1 Companies (`/admin/companies` & `/store/customers/me/company`)

#### `GET /admin/companies`
- **Method**: `GET`
- **Access**: Admin (`user`)
- **Query Parameters**: `limit` (int, default 50), `offset` (int, default 0)
- **Response `200 OK`**:
```json
{
  "companies": [
    {
      "id": "comp_01J...",
      "name": "Acme Corp",
      "email": "purchasing@acme.com",
      "phone": "+1234567890",
      "address": "123 Business Way",
      "city": "London",
      "state": "Greater London",
      "postal_code": "EC1A 1BB",
      "country_code": "gb",
      "currency_code": "eur",
      "employees": [],
      "customer_group": { "id": "cgrp_01..." }
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```
- **Status**: 🟢 `[WORKING]`

#### `POST /admin/companies`
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Request Body**:
```json
{
  "name": "Enterprise Solutions Ltd",
  "email": "procure@enterprise.com",
  "phone": "+442079460912",
  "address": "45 Corporate Blvd",
  "city": "London",
  "state": "London",
  "postal_code": "SW1A 1AA",
  "country_code": "gb",
  "currency_code": "gbp",
  "customer_group_id": "cgrp_01J..."
}
```
- **Response `200 OK`**: `{ "company": { "id": "comp_...", ... } }`
- **Status**: 🟢 `[WORKING]`

#### `GET /admin/companies/:id`
- **Method**: `GET`
- **Access**: Admin (`user`)
- **Response `200 OK`**: Returns company details, expanded with `employees.*` and `customer_group.*`.
- **Status**: 🟢 `[WORKING]`

#### `POST /admin/companies/:id`
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Request Body**: Partial update object with any company fields.
- **Response `200 OK`**: `{ "company": { ... } }`
- **Status**: 🟢 `[WORKING]`

#### `DELETE /admin/companies/:id`
- **Method**: `DELETE`
- **Access**: Admin (`user`)
- **Response `200 OK`**: `{ "id": "comp_...", "object": "company", "deleted": true }`
- **Status**: 🟢 `[WORKING]`

#### `GET /store/customers/me/company`
- **Method**: `GET`
- **Access**: Authenticated Customer (`customer`)
- **Headers**: `Authorization: Bearer <jwt>`, `x-publishable-api-key`
- **Description**: Returns the calling customer's linked company, team members, manager status, and current spending limit.
- **Response `200 OK`**:
```json
{
  "company": {
    "id": "comp_01...",
    "name": "Acme Corp"
  },
  "employee": {
    "id": "emp_01...",
    "is_admin": true,
    "spending_limit": 5000
  },
  "employees": [
    {
      "id": "emp_01...",
      "is_admin": true,
      "spending_limit": 5000,
      "customer": { "id": "cus_01...", "email": "buyer@acme.com" }
    }
  ],
  "is_manager": true,
  "spending_limit": 5000
}
```
- **Status**: 🟢 `[WORKING]`

---

### 2.2 Company Employees & Team (`/admin/companies/:id/employees`)

#### `GET /admin/companies/:id/employees`
- **Method**: `GET`
- **Access**: Admin (`user`)
- **Response `200 OK`**: `{ "employees": [ { "id": "emp_...", "is_admin": true, "spending_limit": 1000, "customer": { ... } } ] }`
- **Status**: 🟢 `[WORKING]`

#### `POST /admin/companies/:id/employees`
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Request Body**:
```json
{
  "email": "new.procurement@acme.com",
  "first_name": "Sarah",
  "last_name": "Connor",
  "password": "TemporaryPassword123!",
  "is_admin": false,
  "spending_limit": 2500,
  "phone": "+441234567890"
}
```
- **Response `200 OK`**: `{ "employee": { "id": "emp_...", ... } }`
- **Status**: 🟢 `[WORKING]`

#### `POST /admin/companies/:id/employees/:employeeId`
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Request Body**: `{ "is_admin": true, "spending_limit": 10000 }`
- **Response `200 OK`**: `{ "employee": { ... } }`
- **Status**: 🟢 `[WORKING]`

#### `DELETE /admin/companies/:id/employees/:employeeId`
- **Method**: `DELETE`
- **Access**: Admin (`user`)
- **Response `200 OK`**: `{ "id": "emp_...", "object": "employee", "deleted": true }`
- **Status**: 🟢 `[WORKING]`

---

### 2.3 Quotes Negotiation Engine (`/store/quotes` & `/admin/quotes`)

The Quotes engine allows corporate buyers to convert shopping carts into price requests, negotiate discounts, add messages, and finalize orders.

#### `POST /store/quotes`
- **Method**: `POST`
- **Access**: Public / Authenticated Buyer (`customer`)
- **Request Body**:
```json
{
  "cart_id": "cart_01J...",
  "note": "Requesting 15% volume discount for 500 units.",
  "target_price": 4200.00,
  "items": [
    { "id": "item_01...", "quantity": 50, "unit_price": 84.00 }
  ]
}
```
- **Response `201 Created`**:
```json
{
  "quote": {
    "id": "quote_01J...",
    "cart_id": "cart_01J...",
    "status": "pending_merchant",
    "metadata": {
      "target_price": 4200.00,
      "messages": [
        {
          "id": "msg_...",
          "sender": "customer",
          "sender_name": "Buyer",
          "text": "Requesting 15% volume discount...",
          "created_at": "2026-09-24T12:00:00Z"
        }
      ]
    }
  }
}
```
- **Status**: 🟢 `[WORKING]`

#### `GET /store/quotes`
- **Method**: `GET`
- **Access**: Authenticated Buyer or Cart Owner
- **Query Parameters**: `cart_id` (optional, filter by specific cart)
- **Response `200 OK`**: `{ "quotes": [ ... ] }` (includes company-wide quotes if caller is employee)
- **Status**: 🟢 `[WORKING]`

#### `POST /store/customers/me/quotes/:id/accept`
- **Method**: `POST`
- **Access**: Buyer (`customer`)
- **Description**: Accepts the merchant's quoted counter-offer and locks pricing.
- **Response `200 OK`**: `{ "quote": { "id": "quote_...", "status": "accepted" } }`
- **Status**: 🟢 `[WORKING]`

#### `POST /store/customers/me/quotes/:id/reject`
- **Method**: `POST`
- **Access**: Buyer (`customer`)
- **Response `200 OK`**: `{ "quote": { "id": "quote_...", "status": "rejected" } }`
- **Status**: 🟢 `[WORKING]`

#### `POST /store/customers/me/quotes/:id/messages`
- **Method**: `POST`
- **Access**: Buyer (`customer`)
- **Request Body**: `{ "text": "Can we include expedited freight?" }`
- **Response `200 OK`**: `{ "quote": { ... }, "message": { ... } }`
- **Status**: 🟢 `[WORKING]`

#### `GET /admin/quotes`
- **Method**: `GET`
- **Access**: Admin (`user`)
- **Response `200 OK`**: `{ "quotes": [ ... ], "count": 10 }`
- **Status**: 🟢 `[WORKING]`

#### `POST /admin/quotes/:id/items`
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Description**: Sets merchant counter-offer prices on quote line items.
- **Request Body**:
```json
{
  "items": [
    { "id": "item_01...", "quantity": 50, "unit_price": 75.00 }
  ],
  "shipping_price": 150.00
}
```
- **Response `200 OK`**: `{ "quote": { ... } }`
- **Status**: 🟢 `[WORKING]`

#### `POST /admin/quotes/:id/send`
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Description**: Sends counter-offer back to the buyer (`status: "pending_customer"`).
- **Response `200 OK`**: `{ "quote": { ... } }`
- **Status**: 🟢 `[WORKING]`

#### `POST /admin/quotes/:id/dispatch` & `/deliver` & `/pay`
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Description**: Admin workflow overrides for fulfillment and payment state transitions.
- **Status**: 🟢 `[WORKING]`

---

### 2.4 B2B Approvals & Spending Limits (`/store/approvals` & `/store/carts/:id/submit-approval`)

#### `POST /store/carts/:id/submit-approval`
- **Method**: `POST`
- **Access**: Buyer / Employee (`customer`)
- **Description**: Triggers approval submission when order total exceeds employee's spending limit.
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Order submitted for manager approval",
  "approval": {
    "id": "appr_01J...",
    "cart_id": "cart_01J...",
    "created_by": "cus_01J..."
  }
}
```
- **Status**: 🟢 `[WORKING]`

#### `GET /store/approvals`
- **Method**: `GET`
- **Access**: Authenticated Company Manager (`customer` where `is_admin == true`)
- **Description**: Lists all pending and historical approval requests across company employees.
- **Response `200 OK`**:
```json
{
  "approvals": [
    {
      "id": "appr_01...",
      "cart_id": "cart_01...",
      "statuses": [{ "status": "pending", "type": "admin" }],
      "cart": { "total": 6500, "currency_code": "eur", "items": [...] }
    }
  ]
}
```
- **Status**: 🟢 `[WORKING]`

#### `POST /store/approvals`
- **Method**: `POST`
- **Access**: Company Manager (`customer`)
- **Request Body**: `{ "approval_id": "appr_01...", "status": "approved" }` (or `"rejected"`)
- **Response `200 OK`**: `{ "success": true, "approval_status": { ... } }`
- **Status**: 🟢 `[WORKING]`

---

## 3. Restaurants & Food Ordering

Powers food merchants, digital restaurant menus, dietary modifiers, and kitchen prep dispatch.

### 3.1 Public Storefront APIs

#### `GET /store/restaurants`
- **Method**: `GET`
- **Access**: Public
- **Description**: Lists all active restaurants.
- **Response `200 OK`**:
```json
{
  "restaurants": [
    {
      "id": "rest_01...",
      "name": "Artisan Pizza & Pasta",
      "handle": "artisan-pizza",
      "is_open": true,
      "address": "74 High Street",
      "phone": "+442081234567",
      "image_url": "https://..."
    }
  ]
}
```
- **Status**: 🟢 `[WORKING]`

#### `GET /restaurants`
- **Method**: `GET`
- **Access**: Public
- **Query Parameters**: `currency_code` (e.g. `eur`)
- **Description**: Returns all restaurants expanded with complete product menus, menu categories, dish variants, and prices.
- **Status**: 🟢 `[WORKING]`

#### `GET /restaurants/:id`
- **Method**: `GET`
- **Access**: Public
- **Description**: Fetches individual restaurant menu, opening status, and categories.
- **Response `200 OK`**: `{ "restaurant": { "id": "...", "products": [...], ... } }`
- **Status**: 🟢 `[WORKING]`

---

### 3.2 Admin Restaurant APIs

#### `POST /restaurants` (or `/admin/restaurants`)
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Request Body**:
```json
{
  "name": "Napoli Trattoria",
  "handle": "napoli-trattoria",
  "address": "12 Little Italy St",
  "phone": "+442089876543",
  "email": "info@napoli.com",
  "image_url": "https://...",
  "is_open": true
}
```
- **Response `200 OK`**: `{ "restaurant": { "id": "rest_...", ... } }`
- **Status**: 🟢 `[WORKING]`

#### `POST /restaurants/:id/products`
- **Method**: `POST`
- **Access**: Admin / Restaurant Operator
- **Request Body**: `{ "product_ids": ["prod_01J..."] }`
- **Description**: Associates menu items/products with a restaurant kitchen.
- **Status**: 🟢 `[WORKING]`

#### `POST /admin/restaurants/:id/admins`
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Request Body**: `{ "user_id": "usr_01..." }`
- **Description**: Links restaurant management permissions to a specific user.
- **Status**: 🟢 `[WORKING]`

---

## 4. Deliveries, Drivers & Real-Time Tracking

The delivery engine manages end-to-end order dispatch, driver assignment, step transitions, and live SSE streaming to mobile client apps.

### 4.1 Delivery State Machine Lifecycle
```
[order_placed]
      │
      ▼
   pending ──(claim / accept)──► claimed ──(prepare)──► preparing ──(ready)──► ready ──(pick-up)──► in_transit ──(complete)──► delivered
```

### 4.2 Endpoints

#### `GET /deliveries/:id`
- **Method**: `GET`
- **Access**: Public / Driver
- **Response `200 OK`**:
```json
{
  "delivery": {
    "id": "del_01...",
    "delivery_status": "in_transit",
    "eta": "2026-09-24T14:30:00Z",
    "driver": {
      "id": "drv_01...",
      "first_name": "Dave",
      "phone": "+447123456789"
    },
    "restaurant": {
      "name": "Artisan Pizza"
    }
  }
}
```
- **Status**: 🟢 `[WORKING]`

#### `GET /deliveries/:id/subscribe` (Live Server-Sent Events SSE)
- **Method**: `GET`
- **Access**: Public / App Client
- **Headers**: `Accept: text/event-stream`
- **Description**: Opens a persistent real-time streaming pipe. Broadcasts workflow state transitions directly to the mobile app whenever a driver or kitchen updates status.
- **Stream Format**:
```
data: {"message":"Subscribed to workflow","transactionId":"trans_..."}

data: {"status":"ready","step":"prepare_complete"}

data: {"status":"in_transit","driver_lat":51.5074,"driver_lng":-0.1278}
```
- **Status**: 🟢 `[WORKING]`

#### Driver Status Actions (`POST /deliveries/:id/*`)

| Endpoint | Method | Actor | Purpose | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/deliveries/:id/claim` | `POST` | Driver | Driver claims the delivery ticket | 🟢 `[WORKING]` |
| `/deliveries/:id/accept` | `POST` | Driver | Driver accepts and confirms the route | 🟢 `[WORKING]` |
| `/deliveries/:id/prepare` | `POST` | Kitchen / Driver | Kitchen starts preparing order | 🟢 `[WORKING]` |
| `/deliveries/:id/ready` | `POST` | Kitchen | Order bagged and waiting for pickup | 🟢 `[WORKING]` |
| `/deliveries/:id/pick-up` | `POST` | Driver | Driver picked up order, en route | 🟢 `[WORKING]` |
| `/deliveries/:id/complete`| `POST` | Driver | Marked as successfully delivered | 🟢 `[WORKING]` |
| `/deliveries/:id/reset` | `POST` | Admin | Emergency reset back to pending | 🟢 `[WORKING]` |

#### `GET /admin/drivers` & `POST /admin/drivers`
- **Method**: `GET`, `POST`
- **Access**: Admin (`user`)
- **Create Payload**: `{ "first_name": "John", "last_name": "Doe", "phone": "+447...", "email": "john.driver@fleet.com" }`
- **Status**: 🟢 `[WORKING]`

---

## 5. Digital Products & Media Licensing

Handles downloadable files, digital licenses, software bundles, and secure customer token streaming.

### 5.1 Endpoints

#### `POST /admin/digital-products`
- **Method**: `POST`
- **Access**: Admin (`user`)
- **Request Body**:
```json
{
  "name": "Design Systems Masterclass (4K Video)",
  "medias": [
    {
      "type": "video",
      "file": "https://storage.railway.app/.../video.mp4",
      "mime_type": "video/mp4"
    }
  ]
}
```
- **Response `200 OK`**: `{ "result": { "digital_product": { ... } } }`
- **Status**: 🟢 `[WORKING]`

#### `POST /store/carts/:id/complete-digital`
- **Method**: `POST`
- **Access**: Shopper / Checkout
- **Description**: Finalizes cart containing digital assets and writes customer digital product entitlements without requiring shipping methods.
- **Response `200 OK`**: `{ "type": "order", "order": { ... } }`
- **Status**: 🟢 `[WORKING]`

#### `GET /store/customers/me/digital-products`
- **Method**: `GET`
- **Access**: Authenticated Customer (`customer`)
- **Description**: Returns all digital products, license keys, and media files purchased by the calling customer.
- **Status**: 🟢 `[WORKING]`

#### `POST /store/customers/me/digital-products/:mediaId/download`
- **Method**: `POST`
- **Access**: Authenticated Customer (`customer`)
- **Description**: Verifies purchase ownership against past order records and generates an authorized, temporary download URL.
- **Response `200 OK`**:
```json
{
  "download_url": "https://s3.us-east-1.amazonaws.com/.../file.zip?X-Amz-Signature=..."
}
```
- **Status**: 🟡 `[WORKING WITH PREREQUISITE]` (Requires S3 storage configured in `.env` for production file delivery; falls back to local file provider)

---

## 6. Rentals & Event Ticketing Engine

Supports time-bounded product rentals and theater/event ticket seat selection with row layouts.

### 6.1 Equipment Rentals

#### `GET /store/products/:id/rental-availability`
- **Method**: `GET`
- **Access**: Public
- **Query Parameters**:
  - `variant_id` (string, required)
  - `start_date` (string `YYYY-MM-DD`, required)
  - `end_date` (string `YYYY-MM-DD`, optional)
  - `currency_code` (string, optional)
- **Response `200 OK`**:
```json
{
  "available": true,
  "booked_dates": ["2026-10-01", "2026-10-02"],
  "rental_days": 3,
  "calculated_price": 270.00,
  "deposit_amount": 100.00
}
```
- **Status**: 🟢 `[WORKING]`

#### `POST /store/carts/:id/line-items/rentals`
- **Method**: `POST`
- **Access**: Public / Shopper
- **Request Body**:
```json
{
  "variant_id": "variant_01...",
  "quantity": 1,
  "start_date": "2026-10-05",
  "end_date": "2026-10-08"
}
```
- **Status**: 🟢 `[WORKING]`

---

### 6.2 Event Ticketing & Venues

#### `GET /store/ticket-products/:id/availability`
- **Method**: `GET`
- **Access**: Public
- **Description**: Returns available dates and remaining seat counts for a show.
- **Response `200 OK`**:
```json
{
  "availability": [
    {
      "date": "2026-11-15T19:00:00Z",
      "total_seats": 250,
      "seats_sold": 180,
      "seats_available": 70,
      "is_sold_out": false
    }
  ]
}
```
- **Status**: 🟢 `[WORKING]`

#### `GET /store/ticket-products/:id/seats`
- **Method**: `GET`
- **Access**: Public
- **Query Parameters**: `date` (`YYYY-MM-DD`, required)
- **Description**: Returns the venue seat map, including rows, seat numbers, and occupied seats.
- **Status**: 🟢 `[WORKING]`

#### `POST /store/carts/:id/line-items/tickets`
- **Method**: `POST`
- **Access**: Public / Shopper
- **Request Body**:
```json
{
  "variant_id": "variant_01...",
  "show_date": "2026-11-15T19:00:00Z",
  "seats": ["A12", "A13"]
}
```
- **Status**: 🟢 `[WORKING]`

#### `POST /store/carts/:id/complete-tickets`
- **Method**: `POST`
- **Access**: Public / Shopper
- **Description**: Finalizes ticket orders and permanently claims assigned seat numbers under database locks.
- **Status**: 🟢 `[WORKING]`

#### `POST /admin/tickets/:id/verify` (or `/vendors/shows/:id/purchases/:purchase_id/scan`)
- **Method**: `POST`
- **Access**: Admin / Venue Scanner Staff
- **Description**: Validates ticket QR code at venue entrance and marks ticket as admitted.
- **Response `200 OK`**: `{ "verified": true, "admitted_at": "2026-11-15T18:45:00Z" }`
- **Status**: 🟢 `[WORKING]`

---

## 7. Marketplace Vendor / Seller APIs

The multi-vendor marketplace provides 35+ standalone submodules under `/vendors/*`. All vendor routes require the `vendor` actor token (`Authorization: Bearer <token>`).

### 7.1 Vendor Auth & Profile
- `POST /auth/vendor/emailpass/register`: Create vendor credentials.
- `POST /auth/vendor/emailpass`: Authenticate and obtain JWT.
- `POST /vendors`: Register and claim vendor business profile.
- `GET /vendors/me`: Get current authenticated vendor details.

### 7.2 Catalog & Product Management

| Endpoint | Method | Description | Status |
| :--- | :--- | :--- | :--- |
| `/vendors/products` | `GET`, `POST` | List vendor products, Create single product | 🟢 `[WORKING]` |
| `/vendors/products/:id` | `GET`, `POST`, `DELETE` | Retrieve, update, or delete vendor product | 🟢 `[WORKING]` |
| `/vendors/products/batch` | `POST` | Batch create/update/delete products | 🟢 `[WORKING]` |
| `/vendors/products/export` | `POST` | Export vendor products to CSV | 🟢 `[WORKING]` |
| `/vendors/products/import` | `POST` | Upload product catalog CSV | 🟢 `[WORKING]` |
| `/vendors/products/:id/variants` | `GET`, `POST` | Manage product variants | 🟢 `[WORKING]` |
| `/vendors/products/:id/options` | `GET`, `POST` | Manage product option types (Size, Color) | 🟢 `[WORKING]` |
| `/vendors/categories` | `GET`, `POST` | Manage vendor category mappings | 🟢 `[WORKING]` |
| `/vendors/collections` | `GET`, `POST` | Curated product collections | 🟢 `[WORKING]` |

### 7.3 Pricing, Inventory & Promotions

| Endpoint | Method | Description | Status |
| :--- | :--- | :--- | :--- |
| `/vendors/price-lists` | `GET`, `POST` | Custom price lists for tiers/sales | 🟢 `[WORKING]` |
| `/vendors/price-lists/:id/prices/batch` | `POST` | Batch upsert prices | 🟢 `[WORKING]` |
| `/vendors/inventory-items` | `GET`, `POST` | Stock tracking across warehouses | 🟢 `[WORKING]` |
| `/vendors/reservations` | `GET`, `POST` | Order inventory reservations | 🟢 `[WORKING]` |
| `/vendors/promotions` | `GET`, `POST` | Promotional discounts & codes | 🟢 `[WORKING]` |
| `/vendors/campaigns` | `GET`, `POST` | Time-limited promotional campaigns | 🟢 `[WORKING]` |
| `/vendors/customer-groups` | `GET`, `POST` | Targeted customer segments | 🟢 `[WORKING]` |

### 7.4 Onboarding & TrustClaw Taxonomy

| Endpoint | Method | Description | Status |
| :--- | :--- | :--- | :--- |
| `/vendors/onboarding/questions` | `GET` | Dynamic questionnaire based on business type | 🟢 `[WORKING]` |
| `/vendors/onboarding/save-step` | `POST` | Save draft onboarding response | 🟢 `[WORKING]` |
| `/vendors/onboarding/status` | `GET` | Current application review status | 🟢 `[WORKING]` |
| `/vendors/onboarding/submit` | `POST` | Final submit for admin compliance approval | 🟢 `[WORKING]` |
| `/vendors/taxonomy/tc-categories` | `GET` | TrustClaw master category taxonomy tree | 🟢 `[WORKING]` |

### 7.5 Orders, Draft Orders & Store Configuration

| Endpoint | Method | Description | Status |
| :--- | :--- | :--- | :--- |
| `/vendors/orders` | `GET` | Vendor's partitioned orders list | 🟢 `[WORKING]` |
| `/vendors/draft-orders` | `GET`, `POST` | Manual phone/custom order drafting | 🟢 `[WORKING]` |
| `/vendors/draft-orders/:id/convert`| `POST` | Convert draft into paid order | 🟢 `[WORKING]` |
| `/vendors/sales-channels` | `GET`, `POST` | Sales channels connected to vendor | 🟢 `[WORKING]` |
| `/vendors/shipping-profiles` | `GET`, `POST` | Shipping rate profiles | 🟢 `[WORKING]` |
| `/vendors/stock-locations` | `GET`, `POST` | Vendor physical warehouses | 🟢 `[WORKING]` |
| `/vendors/tax-regions` | `GET`, `POST` | Regional tax rate overrides | 🟢 `[WORKING]` |
| `/vendors/team` | `GET`, `POST` | Vendor staff members and permissions | 🟢 `[WORKING]` |
| `/vendors/api-keys` | `GET`, `POST` | Vendor developer API keys | 🟢 `[WORKING]` |

---

## 8. Transaction Types & Ledger System

Internal accounting and financial categorization system under `/admin/transaction-types`.

| Endpoint | Method | Description | Status |
| :--- | :--- | :--- | :--- |
| `/admin/transaction-types` | `GET`, `POST` | List and create accounting transaction codes | 🟢 `[WORKING]` |
| `/admin/transaction-types/:id` | `GET`, `POST`, `DELETE` | Retrieve, edit, or archive transaction type | 🟢 `[WORKING]` |
| `/admin/transaction-types/:id/status` | `POST` | Activate or deactivate accounting code | 🟢 `[WORKING]` |
| `/admin/transaction-types/:id/activities`| `GET` | Audit trail of edits and usage | 🟢 `[WORKING]` |
| `/admin/transaction-types/reorder` | `POST` | Priority sorting order in dashboards | 🟢 `[WORKING]` |
| `/admin/transaction-types/import` | `POST` | Bulk CSV import of ledger codes | 🟢 `[WORKING]` |
| `/admin/transaction-types/export` | `POST` | Export ledger types to CSV | 🟢 `[WORKING]` |

---

## 9. Core Shopper & Commerce APIs

Standard Medusa 2.0 storefront operations called by the mobile/web client.

### 9.1 Authentication (`/auth/customer/emailpass`)
- **Register**: `POST /auth/customer/emailpass/register` — `{ "email": "...", "password": "..." }`
- **Login**: `POST /auth/customer/emailpass` — `{ "email": "...", "password": "..." }`
- **Token Format**: Standard Medusa JWT bearer token.

### 9.2 Key Exchange (`GET /key-exchange`)
- **Method**: `GET`
- **Access**: Public
- **Description**: Returns the active publishable API key for the store without requiring manual environment hardcoding in frontend applications.
- **Response `200 OK`**: `{ "publishableApiKey": "pk_27ab5..." }`
- **Status**: 🟢 `[WORKING]`

### 9.3 Shopping Carts (`/store/carts`)
- `POST /store/carts`: Create empty cart. (Payload: `{ "region_id": "reg_...", "currency_code": "eur" }`)
- `GET /store/carts/:id`: Retrieve cart with line items, totals, and shipping methods.
- `POST /store/carts/:id/line-items`: Add standard product variant to cart.
- `POST /store/carts/:id/line-items/:line_id`: Update item quantity.
- `DELETE /store/carts/:id/line-items/:line_id`: Remove item from cart.
- `POST /store/carts/:id/taxes`: Calculate regional taxes.
- `POST /store/carts/:id/payment-collections`: Initialize payment session (Stripe, manual).
- `POST /store/carts/:id/complete`: Complete payment and create order.

### 9.4 Products & Regions
- `GET /store/products`: List products with pagination, search, category filters.
- `GET /store/products/:id`: Get single product with options and variants.
- `GET /store/regions`: List supported currency regions.

---

## 10. Exhaustive Health & Readiness Matrix

| API Domain | Working Endpoints | Status | Mobile / Web App Readiness Notes |
| :--- | :--- | :--- | :--- |
| **B2B Companies** | `GET/POST /admin/companies`, `GET/POST/DELETE /admin/companies/:id`, `GET /store/customers/me/company` | 🟢 `[WORKING]` | Production-ready. Automatically links customer groups and employee spending limits. |
| **B2B Employees** | `GET/POST /admin/companies/:id/employees`, `POST/DELETE .../employees/:employeeId` | 🟢 `[WORKING]` | Production-ready. Supports `spending_limit` and `is_admin` flags. |
| **B2B Quotes** | `GET/POST /store/quotes`, `POST .../quotes/:id/accept`, `POST .../quotes/:id/messages`, `/admin/quotes/:id/items` | 🟢 `[WORKING]` | Production-ready. Draft order creation and negotiation workflows fully active. |
| **B2B Approvals** | `POST /store/carts/:id/submit-approval`, `GET/POST /store/approvals` | 🟢 `[WORKING]` | Production-ready. Verifies manager role before permitting approval status change. |
| **Restaurants** | `GET /store/restaurants`, `GET /restaurants`, `GET /restaurants/:id`, `POST /restaurants` | 🟢 `[WORKING]` | Production-ready. Returns full product trees, variants, and categories. |
| **Deliveries** | `GET /deliveries/:id`, `POST .../accept`, `claim`, `pick-up`, `ready`, `complete` | 🟢 `[WORKING]` | Production-ready. Full state machine transitions verified. |
| **Delivery SSE** | `GET /deliveries/:id/subscribe` | 🟢 `[WORKING]` | Production-ready. Live event-stream directly bound to Medusa Workflow Engine. |
| **Digital Products** | `POST /admin/digital-products`, `POST /store/carts/:id/complete-digital` | 🟢 `[WORKING]` | Production-ready. Creates digital orders without requiring physical shipping. |
| **Digital Download** | `POST /store/customers/me/digital-products/:mediaId/download` | 🟡 `[NEEDS CONFIG]` | Works with local files; requires S3 credentials (`S3_BUCKET`, etc.) for production object storage. |
| **Rentals Availability** | `GET /store/products/:id/rental-availability` | 🟢 `[WORKING]` | Production-ready. Validates overlapping bookings and calculates duration pricing. |
| **Event Ticketing** | `GET .../availability`, `GET .../seats`, `POST .../complete-tickets`, `POST .../verify` | 🟢 `[WORKING]` | Production-ready. Row layout seat maps, lock-based seat reservations, and QR verification. |
| **Vendor Marketplace** | 35 submodules under `/vendors/*` (Catalog, Pricing, Inventory, Team, Onboarding) | 🟢 `[WORKING]` | Production-ready. Partitioned by `vendor_id` and verified with custom middleware. |
| **Accounting Ledger** | `/admin/transaction-types/*` | 🟢 `[WORKING]` | Production-ready. Reordering, activities audit trail, and CSV import/export active. |
| **Key Exchange** | `GET /key-exchange` | 🟢 `[WORKING]` | Production-ready. Allows mobile app to discover publishable API key dynamically. |
| **Core Commerce** | `/store/carts/*`, `/store/products/*`, `/store/customers/*`, `/store/regions` | 🟢 `[WORKING]` | Production-ready standard Medusa 2.0 core operations. |
