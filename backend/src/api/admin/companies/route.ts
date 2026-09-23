import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../modules/company"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

  try {
    const { data: companies, metadata } = await query.graph({
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
        "customer_group.*",
      ],
      pagination: {
        take: limit,
        skip: offset,
      },
    })

    return res.json({
      companies,
      count: metadata?.count ?? companies.length,
      limit,
      offset,
    })
  } catch (error) {
    const companyModule = req.scope.resolve(COMPANY_MODULE) as any
    const [companies, count] = await companyModule.listAndCountCompanies({}, {
      take: limit,
      skip: offset,
    })

    return res.json({
      companies,
      count,
      limit,
      offset,
    })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const body = (req.body || {}) as any

  const { customer_group_id, ...companyData } = body

  const company = await companyModule.createCompanies(companyData)

  if (customer_group_id && remoteLink) {
    await remoteLink.create({
      [COMPANY_MODULE]: {
        company_id: company.id,
      },
      [Modules.CUSTOMER]: {
        customer_group_id,
      },
    })
  }

  return res.status(201).json({ company })
}
