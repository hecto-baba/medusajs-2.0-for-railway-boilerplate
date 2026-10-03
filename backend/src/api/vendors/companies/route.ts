import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../modules/company"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import { getVendorId } from "../shared/vendor-scope"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin) {
    return res.status(401).json({ message: "Vendor not authenticated" })
  }

  // 1. Get companies linked directly to vendor
  let companyIds: string[] = []
  try {
    const { data: [vendor] } = await query.graph({
      entity: "vendor",
      fields: ["id", "companies.id"],
      filters: { id: [vendorAdmin.vendor.id] },
    })
    companyIds = (vendor?.companies || []).map((c: any) => c.id).filter(Boolean)
  } catch {}

  // 2. Query company details
  try {
    const filters: Record<string, any> = {}
    if (companyIds.length > 0) {
      filters.id = companyIds
    }

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
      filters,
      pagination: {
        take: limit,
        skip: offset,
      },
    })

    return res.json({
      companies: companies || [],
      count: metadata?.count ?? (companies || []).length,
      limit,
      offset,
    })
  } catch (error) {
    const companyModule = req.scope.resolve(COMPANY_MODULE) as any
    const [companies, count] = await companyModule.listAndCountCompanies(
      companyIds.length ? { id: companyIds } : {},
      { take: limit, skip: offset }
    )

    return res.json({
      companies: companies || [],
      count,
      limit,
      offset,
    })
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const vendorId = await getVendorId(req)
  const body = (req.body || {}) as any

  const { customer_group_id, ...companyData } = body

  const company = await companyModule.createCompanies(companyData)

  // Link company to the calling vendor
  if (vendorId && remoteLink) {
    try {
      await remoteLink.create([
        {
          [MARKETPLACE_MODULE]: { vendor_id: vendorId },
          [COMPANY_MODULE]: { company_id: company.id },
        },
      ])
    } catch (linkErr) {
      console.warn("Could not create vendor-company link:", linkErr)
    }
  }

  // Optionally link customer group
  if (customer_group_id && remoteLink) {
    try {
      await remoteLink.create({
        [COMPANY_MODULE]: { company_id: company.id },
        [Modules.CUSTOMER]: { customer_group_id },
      })
    } catch (cgErr) {
      console.warn("Could not create company-customer_group link:", cgErr)
    }
  }

  return res.status(201).json({ company })
}
