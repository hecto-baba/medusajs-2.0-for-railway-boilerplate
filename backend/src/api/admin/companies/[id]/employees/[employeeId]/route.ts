import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COMPANY_MODULE } from "../../../../../../modules/company"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  const body = (req.body || {}) as any

  const updateData: any = {
    id: req.params.employeeId,
  }

  if ("is_admin" in body) {
    updateData.is_admin = Boolean(body.is_admin)
  }
  if ("spending_limit" in body) {
    updateData.spending_limit = body.spending_limit ? Number(body.spending_limit) : null
  }

  const employee = await companyModule.updateEmployees(updateData)
  return res.json({ employee })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  await companyModule.deleteEmployees([req.params.employeeId])
  return res.json({ id: req.params.employeeId, object: "employee", deleted: true })
}
