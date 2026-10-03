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

/** Re-throws an axios error with the response body, which axios hides by default. */
async function explain<T>(step: string, request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (error: any) {
    if (error?.response) {
      throw new Error(
        `${step} failed: HTTP ${error.response.status} ${JSON.stringify(error.response.data)}`
      )
    }
    throw error
  }
}

export async function createTestVendor(
  api: any,
  label: string
): Promise<TestVendor> {
  counter += 1
  const unique = `${label}-${Date.now()}-${counter}`
  const email = `${unique}@isolation-test.local`

  const registration: any = await explain(
    "register identity",
    api.post("/auth/vendor/emailpass/register", { email, password: PASSWORD })
  )

  const created: any = await explain(
    "create vendor",
    api.post(
      "/vendors",
      {
        name: `Test Vendor ${unique}`,
        handle: unique,
        admin: { email, first_name: label, last_name: "Tester" },
      },
      { headers: { authorization: `Bearer ${registration.data.token}` } }
    )
  )

  // Fresh login: only this token carries the actor_id.
  const login: any = await explain(
    "login",
    api.post("/auth/vendor/emailpass", { email, password: PASSWORD })
  )

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
