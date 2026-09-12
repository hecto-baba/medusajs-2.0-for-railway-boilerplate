"use server"

import { sdk } from "@lib/config"
import { redirect } from "next/navigation"
import {
  getVendorAuthHeaders,
  getVendorToken,
  removeVendorAuthToken,
  setVendorAuthToken,
} from "./cookies"

export type Vendor = {
  id: string
  name: string
  handle: string
  logo: string | null
}

export type VendorAdmin = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  vendor?: Vendor
}

/**
 * Turns an unknown thrown value into something worth showing a vendor.
 *
 * The SDK rejects with a FetchError carrying the backend's message, but a
 * network failure rejects with a plain Error, so neither shape can be assumed.
 */
const toMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.length) {
      return message
    }
  }

  return fallback
}

/**
 * Registers a vendor and signs them in.
 *
 * Three calls on purpose, because that is what the backend expects:
 *
 *   1. auth.register creates an auth identity with no actor behind it. The
 *      token it returns carries an auth_identity_id but no actor_id, which is
 *      exactly what POST /vendors admits via its allowUnregistered middleware.
 *   2. POST /vendors creates the Vendor and VendorAdmin and writes
 *      app_metadata.vendor_id onto that identity. Until this runs the account
 *      cannot authenticate against any /vendors/* route.
 *   3. auth.login issues a fresh token that now resolves an actor_id.
 *
 * Step 3 is not cosmetic: the step-1 token predates the actor mapping, so
 * reusing it would authenticate as an unregistered identity and every vendor
 * route would reject it.
 */
export async function vendorSignup(
  _currentState: unknown,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string
  const name = (formData.get("name") as string)?.trim()
  const handleInput = (formData.get("handle") as string)?.trim()
  const first_name = (formData.get("first_name") as string)?.trim()
  const last_name = (formData.get("last_name") as string)?.trim()

  if (!email || !password || !name) {
    return "Store name, email and password are all required."
  }

  if (password.length < 8) {
    return "Please choose a password of at least 8 characters."
  }

  let registrationToken: string

  try {
    const token = await sdk.auth.register("vendor", "emailpass", {
      email,
      password,
    })

    if (typeof token !== "string") {
      // emailpass always returns a token string. The other members of the
      // union are OAuth redirect, MFA challenge and pending email
      // verification, none of which this provider issues.
      return "This account needs an extra verification step that the vendor panel does not support yet."
    }

    registrationToken = token
  } catch (error) {
    return toMessage(
      error,
      "Could not create that account. The email may already be registered."
    )
  }

  try {
    await sdk.client.fetch("/vendors", {
      method: "POST",
      headers: { authorization: `Bearer ${registrationToken}` },
      body: {
        name,
        // An empty string would fail the backend's min(1) check, so an unset
        // handle is omitted entirely and the backend derives one.
        ...(handleInput ? { handle: handleInput } : {}),
        admin: {
          email,
          ...(first_name ? { first_name } : {}),
          ...(last_name ? { last_name } : {}),
        },
      },
    })
  } catch (error) {
    // The credential now exists but owns no vendor. That identity is still
    // "claimable" - its app_metadata is empty - so registering again with the
    // same email resumes rather than colliding.
    return toMessage(
      error,
      "Your sign-in was created but the store was not. Please try signing up again with the same email."
    )
  }

  try {
    const loginToken = await sdk.auth.login("vendor", "emailpass", {
      email,
      password,
    })

    if (typeof loginToken !== "string") {
      return "Your store was created. Please sign in to continue."
    }

    await setVendorAuthToken(loginToken)
  } catch {
    return "Your store was created. Please sign in to continue."
  }

  redirect("/orders")
}

export async function vendorLogin(
  _currentState: unknown,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string

  if (!email || !password) {
    return "Enter your email and password."
  }

  try {
    const token = await sdk.auth.login("vendor", "emailpass", {
      email,
      password,
    })

    if (typeof token !== "string") {
      return "This account needs an extra verification step that the vendor panel does not support yet."
    }

    await setVendorAuthToken(token)
  } catch (error) {
    // The backend answers a failed sign-in with "Invalid email or password",
    // which is already the right thing to show: it does not reveal whether
    // the email exists. The fallback only covers the case where the request
    // never reached it at all.
    return toMessage(error, "Could not sign you in. Please try again.")
  }

  redirect("/orders")
}

export async function vendorLogout() {
  await removeVendorAuthToken()
  redirect("/login")
}

/**
 * Reads the signed-in vendor admin, or null when there is no valid session.
 *
 * Uncached on purpose: an auth check that can be served from cache is an auth
 * check that outlives the session it is meant to prove.
 */
export async function getVendorSession(): Promise<VendorAdmin | null> {
  const token = await getVendorToken()

  if (!token) {
    return null
  }

  try {
    const { vendor_admin } = await sdk.client.fetch<{
      vendor_admin: VendorAdmin
    }>("/vendors/me", {
      method: "GET",
      headers: { ...(await getVendorAuthHeaders()) },
      cache: "no-store",
    })

    return vendor_admin ?? null
  } catch {
    // An expired or revoked token lands here, and is treated the same as no
    // session at all so the caller sends the visitor back to sign in.
    return null
  }
}

/**
 * Session guard for vendor pages. Redirects rather than returning null, so a
 * page body can treat the result as always present.
 */
export async function requireVendorSession(): Promise<VendorAdmin> {
  const admin = await getVendorSession()

  if (!admin) {
    redirect("/login")
  }

  return admin
}
