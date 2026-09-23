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
const VENDOR_TOKEN_COOKIE = "_medusa_vendor_jwt"

export const getVendorToken = async (): Promise<string | undefined> => {
  const cookiesStore = await cookies()
  return cookiesStore.get(VENDOR_TOKEN_COOKIE)?.value
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
