/**
 * Client-side calls to the backend's /auth/mfa/* routes, via the /api/auth-mfa
 * proxy (see that route's own comment for why a proxy is needed at all).
 *
 * These are the same core Medusa routes the admin dashboard's profile MFA
 * section calls - see backend/node_modules/@medusajs/auth. They scope by
 * auth_identity_id off the verified token, never by actor type, so they work
 * for a vendor identity exactly as they do for an admin user, with no backend
 * changes on our side.
 */

export type MfaFactor = {
  id: string
  provider: string
  status: "pending" | "enabled" | "disabled"
}

export type MfaSetupResponse = {
  mfa_factor: MfaFactor
  secret?: string
  otpauth_url?: string
}

const request = async <T>(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown
): Promise<T> => {
  const res = await fetch(`/api/auth-mfa/${path}`, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as T
}

export const listMfaFactors = () =>
  request<{ mfa_factors: MfaFactor[] }>("factors", "GET")

export const startMfaSetup = (label: string) =>
  request<MfaSetupResponse>("factors", "POST", { provider: "totp", label })

/** Cancels a pending factor without requiring a verification code. */
export const cancelPendingMfa = (factorId: string) =>
  request<{ mfa_factor: MfaFactor }>(`factors/${factorId}`, "DELETE", {})

export const verifyMfaFactor = (factorId: string, code: string) =>
  request<{ mfa_factor: MfaFactor }>(`factors/${factorId}/verify`, "POST", {
    code,
  })

export const generateMfaRecoveryCodes = () =>
  request<{ recovery_codes: string[] }>("recovery-codes", "POST", {})

/**
 * Disables an enabled factor. The backend requires a verification code once
 * the factor is enabled (it does not for a still-pending one), which is why
 * method/code are optional here - cancelling a pending setup omits them.
 */
export const disableMfaFactor = (
  factorId: string,
  challenge?: { method: string; code: string }
) => request<{ mfa_factor: MfaFactor }>(`factors/${factorId}`, "DELETE", challenge ?? {})
