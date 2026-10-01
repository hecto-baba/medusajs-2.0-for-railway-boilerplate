import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function updateCustomerNames({ container }: ExecArgs) {
  const customerModule = container.resolve(Modules.CUSTOMER) as any
  try {
    const customers = await customerModule.listCustomers()
    for (const c of customers) {
      if (c.email === "manager@apex.com") {
        await customerModule.updateCustomers(c.id, {
          first_name: "Alice",
          last_name: "Vance",
        })
      } else if (c.email === "employee@apex.com") {
        await customerModule.updateCustomers(c.id, {
          first_name: "Bob",
          last_name: "Miller",
        })
      }
    }
    console.log("Customer names updated cleanly!")
  } catch (err) {
    console.error("Error updating names:", err)
  }
}
