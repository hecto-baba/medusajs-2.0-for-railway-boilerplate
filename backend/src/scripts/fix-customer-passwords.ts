import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function fixCustomerPasswords({ container }: ExecArgs) {
  const authModule = container.resolve(Modules.AUTH) as any
  const customerModule = container.resolve(Modules.CUSTOMER) as any

  console.log("Fixing customer auth passwords with authModule.register...")

  const emails = ["employee@apex.com", "manager@apex.com"]
  const password = "Password123!"

  for (const email of emails) {
    const customers = await customerModule.listCustomers({ email })
    if (!customers || customers.length === 0) {
      console.log(`Customer ${email} not found`)
      continue
    }
    const customer = customers[0]
    console.log(`Found customer ${email}: ${customer.id}`)

    // Delete any existing auth identities for this customer
    try {
      const identities = await authModule.listAuthIdentities()
      for (const id of identities) {
        if (id.app_metadata?.customer_id === customer.id) {
          console.log(`Deleting existing auth identity: ${id.id}`)
          await authModule.deleteAuthIdentities([id.id])
        }
      }
    } catch (e) {
      console.warn("Could not cleanup old identities:", e)
    }

    // Register with emailpass
    try {
      const registerRes = await authModule.register("emailpass", {
        body: {
          email,
          password,
        },
      })
      console.log("register result:", JSON.stringify(registerRes))

      if (registerRes.authIdentity) {
        await authModule.updateAuthIdentities({
          id: registerRes.authIdentity.id,
          app_metadata: {
            customer_id: customer.id,
          },
        })
        console.log(`Successfully linked authIdentity ${registerRes.authIdentity.id} to customer ${customer.id}!`)
      }
    } catch (regErr: any) {
      console.error(`Error registering ${email}:`, regErr.message || regErr)
    }
  }

  console.log("Done fixing passwords!")
}
