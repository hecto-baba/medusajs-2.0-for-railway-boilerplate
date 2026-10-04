import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../../modules/company"
import { assertVendorOwns } from "../../shared/vendor-scope"

const assertOwnsCompany = (req: AuthenticatedMedusaRequest) =>
  assertVendorOwns(req, "companies", req.params.id, "Company not found")

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertOwnsCompany(req)

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

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertOwnsCompany(req)

  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  // The id comes last so a body that carries a different "id" cannot redirect the update.
  const company = await companyModule.updateCompanies({
    ...((req.body || {}) as any),
    id: req.params.id,
  })

  return res.status(200).json({ company })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertOwnsCompany(req)

  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  await companyModule.deleteCompanies([req.params.id])
  return res.status(200).json({ id: req.params.id, object: "company", deleted: true })
}
