import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function checkB2BRecipe({ container }: ExecArgs) {
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any
  const pricingModule = container.resolve(Modules.PRICING) as any
  const customerModule = container.resolve(Modules.CUSTOMER) as any
  const apiKeyModule = container.resolve(Modules.API_KEY) as any

  console.log("--- B2B RECIPE AUDIT ---")

  // 1. Sales Channels
  const salesChannels = await salesChannelModule.listSalesChannels()
  console.log("Sales Channels:", salesChannels.map((sc: any) => ({ id: sc.id, name: sc.name })))

  // 2. Publishable API Keys
  if (apiKeyModule) {
    const apiKeys = await apiKeyModule.listApiKeys({ type: "publishable" })
    console.log("Publishable Keys:", apiKeys.map((k: any) => ({ id: k.id, title: k.title, token: k.token })))
  }

  // 3. Customer Groups
  const customerGroups = await customerModule.listCustomerGroups()
  console.log("Customer Groups:", customerGroups.map((cg: any) => ({ id: cg.id, name: cg.name })))

  // 4. Price Lists
  const priceLists = await pricingModule.listPriceLists()
  console.log("Price Lists:", priceLists.map((pl: any) => ({ id: pl.id, title: pl.title, status: pl.status, type: pl.type })))
}
