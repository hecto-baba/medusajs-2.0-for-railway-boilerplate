import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function resetAdminPassword({ container }: ExecArgs) {
  const authModule = container.resolve(Modules.AUTH) as any
  const userModule = container.resolve(Modules.USER) as any

  const email = "admin@yourmail.com"
  const password = "Password123!"

  const users = await userModule.listUsers({ email })
  const adminUser = users[0]
  if (!adminUser) {
    console.log("No admin user found for", email)
    return
  }

  // Delete old provider identities
  const identities = await authModule.listAuthIdentities()
  for (const id of identities) {
    if (id.app_metadata?.user_id === adminUser.id || id.provider_identities?.some((p: any) => p.entity_id === email)) {
      try {
        await authModule.deleteAuthIdentities([id.id])
      } catch (e) {}
    }
  }

  const res = await authModule.register("emailpass", {
    body: { email, password },
  })
  console.log("Register response keys:", Object.keys(res || {}))
  const identity = res?.authIdentity || res

  if (identity?.id) {
    await authModule.updateAuthIdentities([
      {
        id: identity.id,
        app_metadata: {
          user_id: adminUser.id,
        },
      },
    ])
    console.log("Successfully linked admin identity! Email:", email, "Password:", password)
  }
}
