# Appointment Booking — Manual Testing Steps

Verifies Phases 3, 4, and 5 of `APPOINTMENT_BOOKING_MODULE_PLAN.md` against a running dev server. Phases 1 and 2 are already proven (DB constraint + link traversal) and don't need re-testing.

Run these in order — each step's output feeds the next.

## Setup

**1. Start the dev server** (skip if already running — check with `curl -s http://localhost:9000/health`):
```bash
cd medusajs-2.0-for-railway-boilerplate/backend
npx medusa develop
```
Wait for `✔ Server is ready on port: 9000`.

**2. Create a fresh test vendor + admin** (existing vendor accounts have unknown passwords — this creates one we control):
```bash
curl -s -X POST http://localhost:9000/vendors \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": { "name": "Test Provider Co", "handle": "test-provider-co" },
    "vendor_admin": {
      "email": "test-provider@example.com",
      "password": "TestPassword123!",
      "first_name": "Test",
      "last_name": "Provider"
    }
  }'
```
Expect a 200 with the created vendor/admin. If it 400s because the handle/email already exist, change them and retry.

**3. Log in as that vendor admin and capture the token:**
```bash
TOKEN=$(curl -s -X POST http://localhost:9000/auth/vendor/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"test-provider@example.com","password":"TestPassword123!"}' \
  | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")
echo "TOKEN=$TOKEN"
```
Expect a non-empty JWT string. Everything below uses `Authorization: Bearer $TOKEN`.

## Phase 3 — Provider schedule + slot generation

**4. Create the provider profile:**
```bash
curl -s -X POST http://localhost:9000/vendors/providers/me \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"display_name":"Test Provider","timezone":"America/New_York"}'
```
Expect `{"provider": {"id": "...", ...}}`. **Save this `id` as `$PROVIDER_ID`.**

**5. Add recurring hours (every Monday, 9am–5pm, starting today):**
```bash
TODAY=$(date -u +%Y-%m-%dT00:00:00.000Z)
curl -s -X POST http://localhost:9000/vendors/providers/me/recurring-availability \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"day_of_week\":1,\"start_time\":\"09:00\",\"end_time\":\"17:00\",\"effective_from\":\"$TODAY\"}"
```
Expect a 200 with the created rule. Then confirm it's listed:
```bash
curl -s http://localhost:9000/vendors/providers/me/recurring-availability -H "Authorization: Bearer $TOKEN"
```
Expect the rule you just created to appear.

**6. Add a blackout exception for the next Monday** (pick the actual next Monday's date):
```bash
curl -s -X POST http://localhost:9000/vendors/providers/me/exceptions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"date":"<NEXT_MONDAY>T00:00:00.000Z","type":"blackout","reason":"Test blackout"}'
```

**7. Create a product to serve as the bookable service** (via `/admin` — needs a platform admin session, not the vendor token; use the admin dashboard UI or an existing admin API key). Note its `product_id`.

**8. Generate two weeks of slots:**
```bash
DATE_TO=$(date -u -d "+14 days" +%Y-%m-%dT00:00:00.000Z 2>/dev/null || date -u -v+14d +%Y-%m-%dT00:00:00.000Z)
curl -s -X POST http://localhost:9000/vendors/providers/me/slots \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"service_product_id\":\"<PRODUCT_ID>\",\"service_duration_minutes\":30,\"date_from\":\"$TODAY\",\"date_to\":\"$DATE_TO\"}"
```
**Expected pass condition:** the response lists multiple 30-minute `Appointment` slots, all falling on Mondays 9:00–17:00, **and none on the blacked-out Monday** — confirm by grepping the response for that date and finding zero matches.

**9. Confirm via the appointments list:**
```bash
curl -s http://localhost:9000/vendors/providers/me/appointments -H "Authorization: Bearer $TOKEN"
```
Expect all generated slots, `status: "available"`.

## Phase 4 — Storefront booking + the double-booking test

**10. Create a store cart** (needs a region/sales channel — use one already seeded in this store):
```bash
curl -s -X POST http://localhost:9000/store/carts \
  -H "Content-Type: application/json" -H "x-publishable-api-key: <YOUR_PUBLISHABLE_KEY>" \
  -d '{"region_id":"<REGION_ID>"}'
```
Save the returned `cart.id` as `$CART_ID`. (Find a valid `region_id` and publishable key via `/store/regions` and the admin's API Key Management page.)

**11. Add one appointment slot to the cart:**
```bash
curl -s -X POST http://localhost:9000/store/carts/$CART_ID/line-items/appointments \
  -H "Content-Type: application/json" -H "x-publishable-api-key: <YOUR_PUBLISHABLE_KEY>" \
  -d '{"appointment_id":"<APPOINTMENT_ID>","variant_id":"<PRODUCT_VARIANT_ID>"}'
```
Expect 200, cart now has one line item with `metadata.appointment_id` set.

**12. THE critical test — fire two concurrent completion attempts at the same appointment.** Create a second cart, add the *same* `appointment_id` to it, then complete both at once:
```bash
curl -s -X POST http://localhost:9000/store/carts/$CART_ID/complete-appointment &
curl -s -X POST http://localhost:9000/store/carts/$CART_ID_2/complete-appointment &
wait
```
**Expected pass condition:** exactly one request returns a completed order; the other returns an error (`NOT_ALLOWED` — "fully booked") from `validateAppointmentAvailabilityStep`. If a payment step is required first (Stripe test mode), complete a payment session on both carts before this step, using Stripe test card `4242 4242 4242 4242`.

**13. Verify at the database level that this held even under load:**
```bash
node -e "
const { Client } = require('pg');
const dbUrl = require('fs').readFileSync('.env','utf8').match(/^DATABASE_URL=(.*)\$/m)[1];
const c = new Client({ connectionString: dbUrl });
(async () => {
  await c.connect();
  const res = await c.query('select count(*) from appointment_attendee where appointment_id = \$1 and status != \\'cancelled\\'', ['<APPOINTMENT_ID>']);
  console.log('Active attendees for this slot:', res.rows[0].count);
  await c.end();
})();
"
```
**Expected pass condition:** count equals the appointment's `max_capacity` (1, in this test) — never more, no matter how many concurrent requests were fired.

**14. Confirm cancellation frees the slot without refunding:**
```bash
curl -s -X POST http://localhost:9000/vendors/providers/me/appointments -H "Authorization: Bearer $TOKEN" \
  | node -e "process.stdin.on('data',d=>{const a=JSON.parse(d).appointments.find(x=>x.status==='booked');console.log(a?.id, a?.attendees)})"
```
Then, using the attendee id found, run the `cancelAppointmentWorkflow` (via a scratch `medusa exec` script, since no admin route wraps it yet — see "Gaps found" below) and confirm the appointment's `status` flips back to `available` and no payment/refund call was made (check Stripe test dashboard — no refund event).

## Phase 5 — Admin UI click-through

**15. Open the dashboard:** `http://localhost:9000/app`, log in as the vendor admin created in step 2.

**16. Navigate to "My Schedule"** (left sidebar). Confirm:
- The recurring rule from step 5 appears in the weekly hours table
- The exception from step 6 appears in the exceptions table
- "Add hours" and "Add exception" modals open and successfully create new rows

**17. Navigate to "My Appointments".** Confirm the slots generated in step 8 appear, and after step 12's test booking, one row shows `Booked` status with `1 / 1` capacity.

**18. Open the test product's detail page** (as a platform admin, not vendor). Confirm the "Appointment Configuration" widget shows "Bookable", the correct duration, and the provider you created listed by name/email.

## Gaps found while writing these steps (fix before considering Phase 3/4 done)

- **No admin/vendor route exists for cancelling an appointment** — `cancelAppointmentWorkflow` (Phase 3) was written but never wired to an API route. Step 14 above can't be done via curl; it needs a `DELETE /vendors/providers/me/appointments/:attendeeId` (or similar) route added first.
- **Step 7 (creating a product) and step 10 (region/publishable key) assume existing store setup** — if this is a fresh dev DB with no seeded region/sales channel/API key, run the store's seed script first (`npx medusa exec ./src/scripts/seed.ts` per this repo's `package.json`).
- **Payment flow (Stripe test mode) isn't scripted above** — `completeCartWithAppointmentWorkflow` calls `completeCartWorkflow`, which requires a completed payment session on the cart first (same requirement as any normal Medusa checkout). Add `POST /store/carts/:id/payment-sessions` and `POST /store/payment-collections` calls before step 12 if the cart's region requires payment.
