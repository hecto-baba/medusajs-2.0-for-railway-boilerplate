import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../../../modules/company"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const body = (req.body || {}) as any
  const { customer_group_id } = body

  if (!customer_group_id) {
    return res.status(400).json({ message: "customer_group_id is required" })
  }

  // Dismiss any existing link first
  try {
    await remoteLink.dismiss({
      [COMPANY_MODULE]: {
        company_id: req.params.id,
      },
    })
  } catch {}

  // Create new link
  await remoteLink.create({
    [COMPANY_MODULE]: {
      company_id: req.params.id,
    },
    [Modules.CUSTOMER]: {
      customer_group_id,
    },
  })

  return res.json({ success: true, company_id: req.params.id, customer_group_id })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK)
  try {
    await remoteLink.dismiss({
      [COMPANY_MODULE]: {
        company_id: req.params.id,
      },
    })
  } catch {}

  return res.json({ success: true, company_id: req.params.id, customer_group_id: null })
}
