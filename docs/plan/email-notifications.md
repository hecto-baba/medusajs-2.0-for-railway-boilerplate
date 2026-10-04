# Email notifications

Status: **Phases 1 to 9 built** (code and unit tests). Not yet run against a real ZeptoMail inbox or a live database; see section 5.
Provider: **ZeptoMail only**. SendGrid was removed from `medusa-config.js`, `constants.ts`, `package.json` and the READMEs.

## 1. Where we are today

Emails are sent by subscribers in `backend/src/subscribers`, through the notification module and the ZeptoMail provider (`backend/src/modules/email-notifications`). Templates are react-email components registered in `templates/index.tsx`.

If `ZEPTOMAIL_API_KEY` and `ZEPTOMAIL_FROM_EMAIL` are not both set, the notification module is not registered and nothing is sent.

Each subscriber catches send errors and only logs them. A failed email never fails the order, but it is never retried either.

### What sends an email now

| Event | Email | Notes |
|---|---|---|
| `order.placed` | Order confirmation to the buyer | Covers every item type that goes through `complete-all` |
| `order.placed` with tickets | QR-ticket email | May fire before ticket records exist (unverified) |
| `appointment.booked` | Booking confirmation | |
| `appointment.cancelled`, `appointment.rescheduled` | Change notice | |
| `shipment.created` | "Shipped" email to the buyer | Skipped if `no_notification` is set |
| `delivery.created` | "Delivered" email to the buyer | Skipped if `no_notification` is set |
| `digital_product_order.created` | Download email | No duplicate protection |
| `enquiry.responded` | Reply to the enquirer | |
| Password reset, invite events | Standard emails | |

### What does not send an email

- **Payments:** no email for payment captured, failed or refunded.
- **Order cancelled:** the `order.canceled` handler voids payouts and cancels rentals and appointments, but never emails. Only appointments get an email, through their own event.
- **Refunds:** vendors can issue them (`api/vendors/orders/[id]/refunds`), but nothing is emailed.
- **Quotes:** no emails at any step. Acceptance fires `order.placed` by hand, so the buyer gets the generic confirmation only when the workflow succeeds. The fallback accept path sends nothing.
- **Vendors:** no email when a vendor receives an order. Split child orders are created with `createOrdersWorkflow`, which does not fire `order.placed`, so neither vendors nor buyers get duplicate emails from it.
- **Restaurants and drivers:** not emailed by subscribers. How `handleDeliveryWorkflow` notifies them has not been traced.
- **Rentals:** no email for activation, return, deposit refund or forfeiture.
- **B2B approvals:** no email to the manager on submit, none to the employee on approve or reject.
- **EOI:** only the generic order confirmation, which says "order" and not "reservation" and does not mention the unpaid balance.
- **Enquiries:** admins and vendors are not told about a new enquiry.
- **Failed bookings:** if payment succeeds but the appointment hold or ticket seat is lost, the buyer gets no explanation.

## 2. Decisions

| Question | Decision |
|---|---|
| Who receives vendor and restaurant emails? | The email they use to log in to their dashboard |
| Who is the seller on a quote? | The vendor who owns the product |
| Email on payment failure? | Every failure |
| Email on order cancellation? | Every cancellation, automatic ones included |

## 3. Plan

Work one phase at a time. Stop after each phase for review.

### MVP rules (apply to every phase)

Scope is deliberately small. Four things are mandatory; everything else waits.

1. **Persistent idempotency.** Every email carries an `idempotencyKey` such as `order-cancelled:<order id>`. Medusa's notification table has a **unique database index** on this key, and the module skips a key that already succeeded and retries one that failed. So duplicates are blocked by the database, not by a check-then-send query, and no new table or migration is needed. Two workers racing on one key: the loser hits the index and is treated as a duplicate.
2. **Basic retry.** Up to 3 attempts, with 0.5 s then 1.5 s waits, for temporary ZeptoMail failures only (unreachable host, 429, 5xx). Rejected addresses and bad templates are not retried. No queue.
3. **Email never blocks business work.** The send helper never throws. Order, payment and booking succeed even if the email fails; the failure is logged as `email_failed` with template, key and recipient.
4. **Vendor data isolation.** `vendor-new-order` is built per vendor from that vendor's own child order only, never from the parent order. A mixed-vendor test is required: two vendors, each email contains only that vendor's items and totals.

Deferred until needed: a notification queue, a general recipient-lookup service (each phase resolves its own recipient), and shared template building blocks.

### Phase 1: Foundation (done)

1. **Send helper**: `backend/src/lib/send-email.ts`. One function, `sendEmail(container, { template, to, subject, data, idempotencyKey })`. Sets reply-to, applies rules 1 to 3 above, never throws, returns `sent`, `skipped` or `failed`.
2. **Tests**: `backend/integration-tests/unit/send-email.spec.ts` (8 tests: sends with key, skips a duplicate, treats a unique-index collision as a duplicate, retries then succeeds, gives up after 3, does not retry permanent errors, does not throw when email is unconfigured or the recipient is empty).
3. **Not done on purpose**: recipient lookup and shared template pieces (see above). `ADMIN_NOTIFICATION_EMAIL` is added in Phase 3, the first phase that needs it.
4. Existing subscribers are untouched. They move onto the helper as each phase touches them.

### Phase 2: Money and cancellations (built)

1. **Payment received.** Triggered by the payment-captured event. Template `payment-received`.
2. **Payment failed.** Medusa has no standard event for this, so add a small hook in the Stripe webhook handling that emits our own event. Email on every failure. Template `payment-failed`, with a link back to the cart.
3. **Refund issued.** Triggered by the payment-refunded event, which the vendor refund route should produce. Confirm this first, and emit our own event if it does not. Template `refund-issued`, with amount and note.
4. **Order cancelled.** Add a send step to the existing cancel handler, for the buyer's own order only. Vendor child orders stay silent so the buyer is not emailed twice. Template `order-cancelled`, with a reason when known.
5. **Check.** A test order for each case: one email each, and a replayed event produces no second email.

### Phase 3: Failed bookings (built)

1. In the appointment and ticket flows, where a paid order ends up without its booking or seat, emit `booking.failed` and `ticket.failed` events.
2. The buyer gets `booking-failed`: what happened, that a refund will follow, and who to contact.
3. The platform admin gets an alert, because someone has to issue the refund by hand.
4. **Check.** Force a lost seat and a lost appointment hold, and confirm both emails.

### Phase 4: Quotes (built)

1. Emit events from the quote workflows and admin routes: requested, sent, accepted, rejected, status changed. This replaces reliance on the hand-fired `order.placed`, so the fallback accept path also emails.
2. Emails:

   | Step | Goes to | Template |
   |---|---|---|
   | Quote requested | Product vendor, copy to buyer | `quote-requested` |
   | Vendor sends price | Buyer | `quote-sent` |
   | Accepted | Vendor and buyer | `quote-accepted` |
   | Rejected | The other party | `quote-rejected` |
   | Paid, dispatched, delivered | Buyer | `quote-status-update` |

3. **Check.** Run one quote through every step and count the emails.

### Phase 5: Vendors, restaurants and enquiries (built)

1. **Vendor new order.** On `order.placed`, read the per-vendor split records and email each vendor with only their items. Template `vendor-new-order`.
2. **Restaurant new delivery.** First trace how `handleDeliveryWorkflow` currently notifies restaurants and drivers. Then add `restaurant-new-delivery` to the restaurant admins.
3. **New enquiry.** Emit `enquiry.created`. The product's vendor gets `enquiry-received`, and the enquirer gets a short acknowledgement.
4. **Check.** Mixed-vendor test (required): two vendors in one order. Each vendor gets exactly one email containing only their own items and totals, built from their child order.

### Phase 6: B2B approvals (built)

1. On submit, email the company managers (`approval-requested`).
2. On approve or reject, email the employee (`approval-decided`).
3. **Check.** Submit, approve and reject one cart each.

### Phase 7: Rentals (built)

1. Emit events from the rental update workflows.
2. Emails: `rental-activated`, `rental-returned`, `rental-deposit-update` (refunded, partly refunded or forfeited, with the amount).
3. Optional: a reminder the day before the return date.

### Phase 8: EOI wording and related fixes (built)

1. EOI orders get a "reservation" email showing the deposit paid and the balance remaining, instead of the generic order wording. It must not promise a payment link, because the balance is not collected anywhere yet.
2. Move the ticket QR email to its own event, fired after the ticket records exist.
3. Make the digital-download email safe against duplicates.

### Phase 9: Wrap-up (built)

1. Add a table to `backend/src/modules/email-notifications/README.md`: event, template, recipient.
2. Final run-through of every flow against a ZeptoMail test inbox.

## 4. New templates

`payment-received`, `payment-failed`, `refund-issued`, `order-cancelled`, `booking-failed`, `quote-requested`, `quote-sent`, `quote-accepted`, `quote-rejected`, `quote-status-update`, `vendor-new-order`, `restaurant-new-delivery`, `enquiry-received`, `approval-requested`, `approval-decided`, `rental-activated`, `rental-returned`, `rental-deposit-update`, `eoi-confirmation`.

## 5. What was built, and what is left

### Built
- **Phase 1:** `lib/send-email.ts` (idempotency, 3 retries, never throws), `lib/email-notice.ts` (shared helpers), `templates/notice.tsx` (one layout, 22 template keys).
- **Phase 2:** subscribers `payment-captured-email`, `payment-failed-email`, `payment-refunded-email`, `order-canceled-email`.
- **Phase 3:** `lib/booking-failed.ts` emits `booking.failed` from the appointment and ticket steps; `booking-failed-email` emails the buyer and the operator.
- **Phase 4:** `lib/quote-emails.ts` plus `jobs/send-quote-emails.ts`. Quotes change in ~15 places, so a one-minute job reads each recent quote's state instead of patching every route.
- **Phase 5:** `lib/vendor-order-emails.ts` (called from `link-vendor-order`), `restaurant-new-delivery-email` (listens to the existing `notify.restaurant` event), `enquiry-created-email` (new `enquiry.created` event).
- **Phase 6:** `approval-email`, fed by new `approval.requested` and `approval.decided` events.
- **Phase 7:** `rental-email`, fed by new `rental.status_changed` and `rental.deposit_changed` events.
- **Phase 8:** EOI reservation email; ticket email moved to `ticket.purchased`; digital email fixed (below); order and ticket emails now use the idempotent helper.
- **Phase 9:** README table in `email-notifications/README.md`; tests below.

### Things found along the way
- **The digital download email could never send.** It used a template name (`digital-order-template`) that was never registered, so it threw. It now uses `digital-order-ready` and is idempotent.
- **`notify.restaurant` had no listener.** The delivery workflow emitted it but nothing read it.
- **Ticket email timing** is fixed by moving it to `ticket.purchased`.

### Tests (all passing)
`send-email.spec.ts` (8), `notice-email.spec.ts` (templates, quote states, EOI wording) and `vendor-order-emails.spec.ts` (mixed-vendor isolation: each vendor gets only their own items and totals, and a line owned by another vendor is dropped even if it reaches the child order).

One unrelated existing test, `vendor-route-guards.spec.ts`, fails because four vendor routes (`companies/[id]`, `deliveries/[id]`, `digital-products/.../medias/[media_id]`, `quotes/[id]`) have no ownership check. None of this work touched them.

### Still to do
- Send a real email for each flow against a ZeptoMail test inbox. Nothing has been sent to ZeptoMail yet, and the migrations/event wiring has not run against a live database.
- Set `ADMIN_NOTIFICATION_EMAIL` in Railway. Without it, failed-booking alerts to the operator are only logged.
- Run `pnpm install` in `backend` to refresh `pnpm-lock.yaml` after removing the SendGrid package. Remove any `SENDGRID_*` variables from Railway.
- Known behaviour to check: an appointment order that is cancelled gets two emails (`order-cancelled` and the existing `appointment-changed`). A mixed EOI and normal order gets both the order confirmation and the reservation email.
- Not built: a rental return reminder the day before the due date.
- A notification left "pending" by a crash mid-send is not retried.

## 6. Verification against this plan

Checked by reading the code. Nothing has been run against a live database or ZeptoMail.

| Plan item | Status |
|---|---|
| MVP rule 1: DB-backed idempotency | Done (Medusa's unique index on `idempotency_key`; every new email sets a key) |
| MVP rule 2: up to 3 retries on temporary failures | Done and unit-tested |
| MVP rule 3: email never blocks business work | Done (`sendEmail` never throws; subscribers catch) |
| MVP rule 4: vendor isolation + mixed-vendor test | Done and unit-tested |
| Phases 1 to 8: all 22 templates have a sender | Done (each key is used by a subscriber, job or workflow step) |
| Phase 9: README table | Done |
| Confirm vendor refunds emit `payment.refunded` | Confirmed: the route calls `refundPaymentWorkflow`, which emits it |
| Trace how restaurants are notified today | Done: the workflow emitted `notify.restaurant` and nothing listened; a subscriber now does |
| Phase 9: final run-through against a ZeptoMail test inbox | **Pending** |
| `ADMIN_NOTIFICATION_EMAIL` set in Railway | **Pending** (needs your address) |
| `pnpm install` to refresh lockfile (still lists the SendGrid package, 4 lines) | **Pending** |
| Remove `SENDGRID_*` variables from Railway | **Pending** (if they were set) |
| Rental return reminder (optional in the plan) | Deferred (decision: not needed for MVP) |
| Quote message emails (noted as a later addition) | Deferred (decision: add when users ask) |
| EOI mixed orders: plan said add a section to the existing email | Left as two emails (decision: rare, both accurate) |
| Move older subscribers onto `sendEmail` | **Done**: appointment booked and changed, enquiry reply, password reset, invite and shipped/delivered emails now use idempotency keys and retries. The appointment emails keep their existing "sent" flags and only mark an attendee when every email for it went out |
| A real DB-level idempotency test | Not done (unit tests mock the notification module) |

## 7. Audit (correctness, races, dead code, types, security, performance, idempotency, errors, N+1)

Done by reading every file this work added or changed, running the type checker (also with unused-code checks), and the unit tests. Not run against a live database or ZeptoMail.

### Bugs found and fixed
1. **Retry design was wrong (idempotency, correctness).** Retrying a failed email under the same key makes Medusa's notification module send it again and then crash updating a record it never saved. A delivered email would be logged as failed, and the quote job would have resent it every minute for 30 minutes. Now each attempt has its own key (`key`, `key~1`, `key~2`...), a success or a fresh in-flight send blocks further sends, a dead `pending` row (older than 10 minutes) is ignored, and total attempts are capped at 8.
2. **N+1 in the quote job.** It loaded every vendor and product once per quote, every minute. Now: one query for quotes, one for product owners, one for vendor emails, and one for what was already sent, so finished emails cost nothing.
3. **N+1 in vendor order emails.** One owner lookup and one order read per vendor. Now one of each for the whole order.
4. **Unneeded Stripe calls.** The payment-failed listener asked Stripe to interpret every webhook (including created/processing, which makes an extra Stripe call). It now ignores everything that is not a failure event before calling the provider.
5. **Spam relay.** The enquiry acknowledgement went to whatever address a guest typed. Now only signed-in customers get it.
6. **Uncaught errors.** The vendor email path could throw before its own guard; the order-confirmation, invite and enquiry-reply handlers did their lookups outside any try/catch. All are now guarded.
7. **Dead code.** Removed unused variables and imports left by the migration (appointment booked/changed, enquiry reply, fulfilment email).

### Checked and fine
- **Type errors:** none. Note that many lookups use `any`, so the type checker cannot catch a wrong field name in a query; only a live run can.
- **Races:** two workers sending the same email hit the unique key index; the loser is treated as a duplicate. The quote job overlapping itself is covered by the same index.
- **Security:** template text is escaped by React; subjects go in a JSON body, not raw headers; vendor emails carry only that vendor's items and totals (tested); reset and invite tokens are hashed in keys.

### Known risks left
- **Field names in queries are unverified.** Filters such as order by payment, cart by payment collection, quote customer and draft order email are written to match how the rest of the code queries, but have not run. A wrong one makes that email silently not send (logged as an error). A live test of each flow is the only way to close this.
- **Workflow events.** Emitting events inside workflows (rentals, enquiries, tickets) means a broken event bus fails the workflow, as Medusa's own events already do.
- **PII in logs.** `email_failed` log lines contain the recipient address.
- A guest's order-confirmation and quote emails still go to an address the buyer typed, as before.
- Email for a payment-failed on a cart with no email on it is skipped.

## 8. Fixes to bugs found in the wider system

Found while studying the system (not part of the email work). Unit-tested; not run against a live database.

### Fixed
| Problem | Fix |
|---|---|
| Any seller could read, change or accept ANY seller's quote (`vendors/quotes/[id]`), and the list showed every seller's quotes (its filter ended in `return true`, and an error fell back to listing all) | Ownership check on every quote route (quote names the seller, or an item is their product); list scoped properly; error returns 500 instead of listing everyone |
| A seller could set any quote to any status (the quote POST defaulted to "accepted") | A seller can only send a price or decline an open quote; never accept; a decided quote is final |
| A seller could write `payment_status` / `fulfillment_status` / `vendor_id` into quote metadata | Those keys are stripped from seller input |
| Any seller could update or DELETE any company (`vendors/companies/[id]`); a seller with no companies saw ALL companies | Ownership check on get/update/delete; empty list returns nothing; a body `id` can no longer redirect an update |
| Any seller could read or change any delivery (`vendors/deliveries/[id]`); an error fell back to listing all deliveries | Delivery must be for one of the seller's restaurants; error returns 500 |
| A seller could delete another seller's digital media by passing their own product id with the other media id | Media must belong to that product, and ownership uses the shared guard |
| A buyer could accept a quote the seller had not priced yet, at the original cart price | Accept requires `pending_customer`. Applied to both buyer routes and the workflow step |
| An accepted quote could be declined, and a declined one reopened or re-sent | Decided quotes (accepted, either declined) are final across buyer, seller and admin routes |
| Admin accept worked from any state | Only open quotes |
| B2B spending limit: a cart counted as approved if it was EVER approved, even if rejected afterwards; check errors were swallowed silently | The newest decision wins; errors are logged |

Correction to an earlier finding: the B2B spending-limit check is NOT limited to rental carts. It runs for every cart.

### Not fixed: need a decision from you
| Problem | The decision |
|---|---|
| Quote "paid" is a flag with no payment record | Take real payments for quotes (a Stripe payment collection on the draft order), or keep manual payment and record who marked it paid and when? |
| Quote negotiated prices live in metadata and do not reach the real order total | Write the negotiated prices onto the draft order's items, or keep metadata as the source of truth? |
| Declining a quote leaves an orphan draft order | Cancel/delete the draft order on decline? |
| EOI: the balance is never collected; no expiry; cancelling does not refund or release stock | Should a reservation expire? Who collects the balance, and how? |
| Restaurants: one cart makes two orders, and a failed delivery creation is swallowed | Keep the delivery order as a separate record, or drop it? |
| Appointments: cancelling does not refund or cancel the order | Automatic refund on cancel, or manual? Within what window? |
| Tickets and appointments: a paid order can end with no seat or booking | Refund automatically when this happens, or alert you (done) and refund by hand? |
| `transaction-type` is an admin list that nothing reads | Wire it into carts and orders, or remove it? |
