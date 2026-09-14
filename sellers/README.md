# Vendor Panel

Seller-facing panel for the marketplace. Separate from `storefront/` because it
is an operator tool rather than a shopping surface: it shares no layout, no
navigation and no session with the shopper site, and deploying one should not
require redeploying the other.

Runs on port **7000**.

## Local development

The backend must be running first - every page here is server-rendered against
it, so signing in fails without it.

```bash
cd ../backend && pnpm dev      # :9000
cd ../sellers && pnpm dev # :7000
```

| Page | URL |
| --- | --- |
| Sign up | http://localhost:7000/signup |
| Sign in | http://localhost:7000/login |
| Dashboard | http://localhost:7000/dashboard |

## How authentication works

Vendors are a custom actor type (`vendor`) on the Medusa backend, not customers
and not admin users. Registration is three calls, because the backend models
credentials and domain records separately:

1. `POST /auth/vendor/emailpass/register` creates an auth identity. Its token
   carries no `actor_id` yet.
2. `POST /vendors` claims that identity: it creates the `Vendor` and
   `VendorAdmin` and writes `app_metadata.vendor_id`. The backend's middleware
   admits the step-1 token here via `allowUnregistered`.
3. `POST /auth/vendor/emailpass` issues a token that now resolves an
   `actor_id`, which is what every `/vendors/*` route scopes on.

Step 3 is not cosmetic - the step-1 token predates the actor mapping, so
reusing it authenticates as an unregistered identity and every vendor route
rejects it.

The session token is kept in an httpOnly cookie and is only ever read in server
actions, so it never reaches client JavaScript.

## Configuration

`NEXT_PUBLIC_MEDUSA_BACKEND_URL` - the backend this panel talks to.

## Ports and deployment

`dev` pins port 7000 so the three local apps (backend 9000, storefront 8000,
this panel 7000) do not collide. `start` deliberately passes no `-p`: Next
reads `PORT` from the environment, so a host that injects one - Railway does -
is respected without a second, conflicting setting.

Note that `PORT` in `.env.local` has no effect. Next reads it from the real
process environment, not from the env file, so a value there silently does
nothing and the server comes up on 3000.

Deploying to Railway means adding one more service alongside the backend and
storefront, with root directory `sellers` and
`NEXT_PUBLIC_MEDUSA_BACKEND_URL` pointing at the deployed backend.

### CORS

Medusa applies CORS to three prefixes only - `/admin` (`adminCors`), `/store`
(`storeCors`) and `/auth` (`authCors`). Custom routes such as `/vendors/*` get
no CORS middleware at all.

That is fine for this panel as it stands: every backend call happens inside a
server action, so Next reaches the backend server-to-server and no browser
preflight is involved. Nothing has to be added to `AUTH_CORS` for the panel to
work today.

It starts to matter the moment any component calls the backend directly from
the browser - a client-side `fetch`, or the SDK used in a `"use client"` file.
`/auth/*` would then need this panel's origin in `AUTH_CORS`, and `/vendors/*`
would need CORS enabled for it explicitly, since no setting covers it.
Keeping backend calls in server actions avoids both.
