import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../modules/company"

export default async function inspectCompany({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: companies } = await query.graph({
    entity: "company",
    fields: [
      "id",
      "name",
      "employees.*",
      "employees.customer.*",
    ],
  })

  console.log("Found companies:", JSON.stringify(companies, null, 2))
}
