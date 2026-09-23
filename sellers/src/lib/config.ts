import Medusa from "@medusajs/js-sdk"

// Defaults to the standard Medusa port.
let MEDUSA_BACKEND_URL = "http://localhost:9000"

if (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
}

/**
 * No publishableKey here, unlike the storefront's client.
 *
 * That header scopes /store/* requests to a sales channel. The vendor panel
 * only ever calls /auth/vendor/* and /vendors/*, which authenticate by actor
 * token instead, so sending one would be meaningless.
 */
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
})
