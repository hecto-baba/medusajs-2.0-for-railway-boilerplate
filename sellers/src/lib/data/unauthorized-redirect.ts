/**
 * Sends the seller to the login page when their session has expired.
 *
 * The panel talks to the backend through the same-origin proxy under
 * /api/vendors. When the session cookie is missing or the token has expired the
 * proxy (or the backend) answers 401, but nothing on the client acted on it: the
 * page stayed open, every action failed with a toast, and the seller was only sent
 * to /login on the next full navigation.
 *
 * Wrapping fetch once covers every call site (the API client has many), instead of
 * repeating the check in each. Only /api/vendors is watched: other endpoints, such
 * as the MFA proxy, may answer 401 for a reason that is not an expired session.
 */

const WATCHED_PREFIX = "/api/vendors"
const LOGIN_PATH = "/login"

let installed = false

const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === "string") {
    return input
  }
  if (input instanceof URL) {
    return input.pathname
  }
  return input.url
}

const isWatched = (url: string): boolean => {
  try {
    return new URL(url, window.location.origin).pathname.startsWith(WATCHED_PREFIX)
  } catch {
    return false
  }
}

export const installUnauthorizedRedirect = (): void => {
  if (typeof window === "undefined" || installed) {
    return
  }

  installed = true
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init)

    if (
      response.status === 401 &&
      isWatched(urlOf(input)) &&
      !window.location.pathname.startsWith(LOGIN_PATH)
    ) {
      window.location.assign(`${LOGIN_PATH}?expired=1`)
    }

    return response
  }
}
