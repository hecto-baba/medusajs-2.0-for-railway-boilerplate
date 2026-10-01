/**
 * Two-seller fixtures for the cross-seller isolation tests.
 *
 * A seller is created exactly as the real signup does (see
 * sellers/README.md): register an identity, claim it with POST /vendors, then
 * log in again so the token carries the new actor_id.
 */

export type TestVendor = {
  label: string
  vendorId: string
  email: string
  /** Headers to authenticate as this seller. */
  headers: { headers: { authorization: string } }
}

const PASSWORD = "supersecret-Test-1"

let counter = 0

export async function createTestVendor(
  api: any,
  label: string
): Promise<TestVendor> {
  counter += 1
  const unique = `${label}-${Date.now()}-${counter}`
  const email = `${unique}@isolation-test.local`

  const registration = await api.post("/auth/vendor/emailpass/register", {
    email,
    password: PASSWORD,
  })

  const created = await api.post(
    "/vendors",
    {
      name: `Test Vendor ${unique}`,
      handle: unique,
      admin: { email, first_name: label, last_name: "Tester" },
    },
    { headers: { authorization: `Bearer ${registration.data.token}` } }
  )

  // Fresh login: only this token carries the actor_id.
  const login = await api.post("/auth/vendor/emailpass", {
    email,
    password: PASSWORD,
  })

  return {
    label,
    vendorId: created.data.vendor.id,
    email,
    headers: { headers: { authorization: `Bearer ${login.data.token}` } },
  }
}

/**
 * Runs a request and returns the response whether it succeeded or failed.
 * Isolation tests assert on status codes, so failures must not throw.
 */
export async function call(request: Promise<any>): Promise<{
  status: number
  data: any
}> {
  try {
    const res = await request
    return { status: res.status, data: res.data }
  } catch (error: any) {
    if (error?.response) {
      return { status: error.response.status, data: error.response.data }
    }
    throw error
  }
}
