import "server-only"
import { cookies } from "next/headers"

/**
 * The vendor session token.
 *
 * This app has its own origin, so the cookie no longer has to avoid colliding
 * with the storefront's _medusa_jwt - browsers scope cookies per origin. The
 * name is still explicit rather than reusing _medusa_jwt, so a shared parent
 * domain later (shop.example.com plus vendors.example.com) cannot cause the
 * two sessions to overwrite each other.
 */
import type { NextRequest } from "next/server"

const VENDOR_TOKEN_COOKIE = "_medusa_vendor_jwt"

export const getVendorToken = async (
  req?: NextRequest
): Promise<string | undefined> => {
  if (req) {
    const fromReqCookie = req.cookies.get(VENDOR_TOKEN_COOKIE)?.value
    if (fromReqCookie) return fromReqCookie

    const authHeader = req.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7).trim()
    }

    const rawCookie = req.headers.get("cookie")
    if (rawCookie) {
      const match = rawCookie.match(
        new RegExp(`(?:^|;\\s*)${VENDOR_TOKEN_COOKIE}=([^;]*)`)
      )
      if (match && match[1]) return decodeURIComponent(match[1])
    }
  }

  try {
    const cookiesStore = await cookies()
    return cookiesStore.get(VENDOR_TOKEN_COOKIE)?.value
  } catch {
    return undefined
  }
}

export const getVendorAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  const token = await getVendorToken()

  if (token) {
    return { authorization: `Bearer ${token}` }
  }

  return {}
}

export const setVendorAuthToken = async (token: string) => {
  const cookiesStore = await cookies()
  cookiesStore.set(VENDOR_TOKEN_COOKIE, token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeVendorAuthToken = async () => {
  const cookiesStore = await cookies()
  cookiesStore.set(VENDOR_TOKEN_COOKIE, "", { maxAge: -1 })
}
