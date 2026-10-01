import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../../modules/company"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: [company] } = await query.graph({
      entity: "company",
      fields: [
        "id",
        "name",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "postal_code",
        "country_code",
        "currency_code",
        "employees.*",
        "employees.customer.*",
        "customer_group.*",
      ],
      filters: {
        id: req.params.id,
      },
    })

    if (company) {
      return res.json({ company })
    }
  } catch {}

  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  const company = await companyModule.retrieveCompany(req.params.id)
  return res.json({ company })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  const company = await companyModule.updateCompanies({
    id: req.params.id,
    ...((req.body || {}) as any),
  })

  return res.status(200).json({ company })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  await companyModule.deleteCompanies([req.params.id])
  return res.status(200).json({ id: req.params.id, object: "company", deleted: true })
}
