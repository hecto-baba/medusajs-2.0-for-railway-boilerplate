import { call } from "./vendors"

const PASSWORD = "supersecret-Test-1"
let counter = 0

export type TestCustomer = {
  customerId: string
  email: string
  /** Headers for a signed-in storefront call as this customer. */
  headers: { headers: Record<string, string> }
}

/**
 * A storefront customer signed up the way the storefront does it: register an
 * identity, create the customer with that token, then sign in again so the token
 * carries the customer id.
 */
export const createTestCustomer = async (
  api: any,
  publishableHeaders: { headers: Record<string, string> },
  label: string
): Promise<TestCustomer> => {
  counter += 1
  const email = `${label}-${Date.now()}-${counter}@customers.test`

  const registered: any = await api.post("/auth/customer/emailpass/register", { email, password: PASSWORD })
  const created = await call(
    api.post(
      "/store/customers",
      { email, first_name: label, last_name: "Buyer" },
      { headers: { ...publishableHeaders.headers, authorization: `Bearer ${registered.data.token}` } }
    )
  )
  if (created.status >= 400) {
    throw new Error(`create customer failed: HTTP ${created.status} ${JSON.stringify(created.data)}`)
  }

  const login: any = await api.post("/auth/customer/emailpass", { email, password: PASSWORD })

  return {
    customerId: created.data.customer.id,
    email,
    headers: { headers: { ...publishableHeaders.headers, authorization: `Bearer ${login.data.token}` } },
  }
}
