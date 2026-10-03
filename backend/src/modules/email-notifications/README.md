# Email templates

This directory contains all the email templates used in the application using `react-email`.

Run the following command to start the development server:

```bash
pnpm email:dev
```

This will start a react-email server at `http://localhost:3002` where you can preview the email templates.

## What this template sends

| Template | Sent by | When |
| -------- | ------- | ---- |
| `order-placed` | `src/subscribers/order-placed.ts` | A shopper completes an order. |
| `invite-user` | `src/subscribers/invite-created.ts` | An administrator is invited, or the invite is resent. |
| `reset-password` | `src/subscribers/password-reset.ts` | Someone asks to reset a password, whether a shopper or an administrator. |

All three need a configured provider: `ZEPTOMAIL_API_KEY` **and** `ZEPTOMAIL_FROM_EMAIL`
together (or the SendGrid pair). With only one of a pair set, the notification
module is not registered at all and nothing sends, silently.

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
