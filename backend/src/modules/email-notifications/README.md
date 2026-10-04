# Email templates

This directory contains all the email templates used in the application using `react-email`.

Run the following command to start the development server:

```bash
pnpm email:dev
```

This will start a react-email server at `http://localhost:3002` where you can preview the email templates.

## What sends an email

Every email is sent through `sendEmail` (`src/lib/send-email.ts`). It gives each email a unique
idempotency key (enforced by a unique index in the notification table, so the same email is never sent
twice), retries temporary ZeptoMail failures up to 3 times, and never throws: an order, payment or booking
always succeeds even if its email cannot be sent. Failures are logged as `email_failed`.

Short status emails share one layout (`templates/notice.tsx`); the rest have their own template.

| Template | Sent by | To | When |
| -------- | ------- | -- | ---- |
| `order-placed` | `subscribers/order-placed.ts` | Buyer | An order is placed (skipped for reservation-only orders) |
| `eoi-confirmation` | `subscribers/order-placed.ts` | Buyer | An order contains reservation (EOI) lines; states deposit and uncharged balance |
| `ticket-order-placed` | `subscribers/ticket-order-placed.ts` | Buyer | `ticket.purchased`, after the ticket records exist |
| `appointment-booked` / `appointment-changed` | `subscribers/appointment-*.ts` | Buyer | Booking confirmed, cancelled, rescheduled |
| `fulfillment-update` | `subscribers/buyer-*-email.ts` | Buyer | A seller ships or delivers part of an order |
| `payment-received` | `subscribers/payment-captured-email.ts` | Buyer | A payment is captured more than 2 minutes after checkout (card payments are covered by the order confirmation) |
| `payment-failed` | `subscribers/payment-failed-email.ts` | Shopper | Every failed Stripe payment attempt |
| `refund-issued` | `subscribers/payment-refunded-email.ts` | Buyer | `payment.refunded`, one email per refund |
| `order-cancelled` | `subscribers/order-canceled-email.ts` | Buyer | The buyer's own order is cancelled, by anyone, including automatic cancels. Seller child orders are silent |
| `booking-failed` | `subscribers/booking-failed-email.ts` | Buyer | Paid, but the appointment time or ticket seat was lost |
| `booking-failed-admin` | `subscribers/booking-failed-email.ts` | Platform operator | Same event; a refund must be issued by hand |
| `quote-requested` | `jobs/send-quote-emails.ts` | Product vendor + buyer copy | A quote is requested |
| `quote-sent` | `jobs/send-quote-emails.ts` | Buyer | The vendor sends their price |
| `quote-accepted` | `jobs/send-quote-emails.ts` | Vendor + buyer | The buyer accepts |
| `quote-rejected` | `jobs/send-quote-emails.ts` | The other party | Either side declines |
| `quote-status-update` | `jobs/send-quote-emails.ts` | Buyer | Paid, dispatched, delivered |
| `vendor-new-order` | `subscribers/link-vendor-order.ts` | Each vendor's admins | An order is placed; only that vendor's own items and totals |
| `restaurant-new-delivery` | `subscribers/restaurant-new-delivery-email.ts` | Restaurant admins | `notify.restaurant` |
| `enquiry-received` | `subscribers/enquiry-created-email.ts` | Product vendor (or platform operator) | A shopper asks about a product |
| `enquiry-acknowledged` | `subscribers/enquiry-created-email.ts` | Enquirer | Same event |
| `enquiry-responded` | `subscribers/enquiry-responded.ts` | Enquirer | The seller replies |
| `approval-requested` | `subscribers/approval-email.ts` | Company managers | An employee submits a cart for approval |
| `approval-decided` | `subscribers/approval-email.ts` | The employee | A manager approves or rejects |
| `rental-activated` / `rental-returned` | `subscribers/rental-email.ts` | Renter | Rental starts, rental returned |
| `rental-deposit-update` | `subscribers/rental-email.ts` | Renter | Deposit refunded, partly refunded or forfeited |
| `digital-order-ready` | `workflows/fulfill-digital-order` | Buyer | A digital order is fulfilled |
| `invite-user` | `subscribers/invite-created.ts` | Invited admin | Invite created or resent |
| `reset-password` | `subscribers/password-reset.ts` | Whoever asked | A password reset is requested |

Quote emails are driven by a job that runs every minute and reads each recently changed quote's current
state, because quotes change in about fifteen places. A failed send is retried on the next run for 30 minutes.

Settings: `ZEPTOMAIL_API_KEY` **and** `ZEPTOMAIL_FROM_EMAIL` (with only one set, the notification module
is not registered and nothing sends), `ORDER_REPLY_TO_EMAIL` (reply-to; defaults to the sender), and
`ADMIN_NOTIFICATION_EMAIL` (platform operator alerts such as failed bookings; without it those alerts
are only logged).

Not built: a reminder email the day before a rental is due back.

### A note on the reset-password link

The email links to different places depending on who asked:

- **Administrator** (`actor_type: "user"`): `BACKEND_URL/app/reset-password?token=...`.
  That page is served by this backend, so nothing needs configuring.
- **Shopper** (anything else): `STOREFRONT_URL/reset-password?token=...&email=...`,
  where `STOREFRONT_URL` falls back to the first plain origin in `STORE_CORS`.
  No region prefix, because the storefront's middleware adds one and keeps the
  query string.

The destination is taken from server configuration only, never from the request.
The reset-password API route accepts a caller-supplied `metadata` bag, and
letting a callback URL through it would let anyone mail a real customer a real
reset token pointing at a site they control.

In development (`NODE_ENV=development`) the subscriber also prints the link to
the console, so the flow can be exercised without a mail provider.

## Base Template

All email templates use a shared base template (`base.tsx`) that provides consistent styling across all emails. The base template includes:

- Consistent font family and sizing
- Email body container
- Background color

This ensures a unified look and feel across all email communications while allowing individual templates to focus on their specific content.

## Usage

### Trigger an email notification

To send a notification using an email template, specify the template key and required data when calling `createNotifications`:

```typescript
await notificationModuleService.createNotifications({
  to: invite.email,
  channel: 'email',
  template: EmailTemplates.INVITE_USER, // Use the enum for the template key
  data: {
    emailOptions: {
      replyTo: 'info@example.com',
      subject: "You've been invited!",
    },
    inviteLink: `${BACKEND_URL}/app/invite?token=${invite.token}`,
    preview: 'Get started with your invitation...',
  },
})
```

### Adding a new template

To add a new email template:

#### 1. Create the template component

Add a new file in the templates directory, following the `react-email` component style and using the base template. For example, `new-template.tsx`:

```tsx
import { Text } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const NEW_TEMPLATE_KEY = 'new-template'

export interface NewTemplateProps {
  greeting: string
  actionUrl: string
  preview?: string
}

export const isNewTemplateData = (data: any): data is NewTemplateProps =>
  typeof data.greeting === 'string' && typeof data.actionUrl === 'string'

export const NewTemplate = ({ greeting, actionUrl, preview = 'You have a new message' }: NewTemplateProps) => (
  <Base preview={preview}>
    <Text>{greeting}</Text>
    <Text>Click <a href={actionUrl}>here</a> to take action.</Text>
  </Base>
)

// Add preview props for the email dev server
NewTemplate.PreviewProps = {
  greeting: 'Hello there!',
  actionUrl: 'https://example.com/action',
  preview: 'Preview of the new template'
} as NewTemplateProps
```

#### 2. Add the new template key to the `EmailTemplates` enum:

```typescript
import { NEW_TEMPLATE_KEY } from './new-template'

export enum EmailTemplates {
  // ...
  NEW_TEMPLATE = NEW_TEMPLATE_KEY, // Add new key here
}
```

#### 3. Add template handling to `generateEmailTemplate`
Update the `generateEmailTemplate` function to handle the new template:

```tsx
import NewTemplate, { NEW_TEMPLATE_KEY, isNewTemplateData } from './new-template'

export enum EmailTemplates {
  // ...
  NEW_TEMPLATE = NEW_TEMPLATE_KEY,
}

export function generateEmailTemplate(templateKey: string, data: unknown): ReactNode {
  switch (templateKey) {
    // ...
    case EmailTemplates.NEW_TEMPLATE:
      if (!isNewTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.NEW_TEMPLATE}"`
        )
      }
      return (<NewTemplate {...data} />)
    default:
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown template key: "${templateKey}"`,
      )
  }
}
```

#### 4. Trigger the new template in a subscriber
Finally, call `createNotifications` with the new template key and data

```typescript
await notificationModuleService.createNotifications({
  to: user.email,
  channel: 'email',
  template: EmailTemplates.NEW_TEMPLATE, // or 'new-template'
  data: {
    emailOptions: {
      subject: 'Action Required',
      replyTo: 'support@example.com',
    },
    greeting: 'Hello there!',
    actionUrl: `${BACKEND_URL}/take-action?token=${user.token}`,
    preview: 'An important action is awaiting you...',
  },
})
```

## Provider

Mail is sent through the [ZeptoMail API](https://www.zoho.com/zeptomail/help/api/email-sending.html)
by `services/zeptomail.ts`. Templates are `react-email` components, rendered to HTML before sending.

| Variable | Purpose |
| --- | --- |
| `ZEPTOMAIL_API_KEY` | Send Mail token |
| `ZEPTOMAIL_FROM_EMAIL` | Verified sender address |
| `ZEPTOMAIL_FROM_NAME` | Sender display name (optional) |
| `ZEPTOMAIL_API_URL` | Only for non-default data centres, e.g. `https://api.zeptomail.in/v1.1/email` |

Per-message options read from `emailOptions`: `subject`, `replyTo`, `cc`, `bcc`, `text`.

### React Email

For more information on how to use `react-email`, refer to the official [documentation](https://react.email/)
