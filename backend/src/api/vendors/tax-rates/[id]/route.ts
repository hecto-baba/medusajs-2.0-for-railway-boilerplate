import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  deleteTaxRatesWorkflow,
  updateTaxRatesWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertVendorOwns } from "../../shared/vendor-scope"
import { refetchTaxRate, UpdateVendorOwnTaxRateSchema } from "../helpers"

export { UpdateVendorOwnTaxRateSchema }

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwns(req, "tax_rates", id, "Tax rate not found.")

  res.json({ tax_rate: await refetchTaxRate(req, id) })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorOwnTaxRateSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwns(req, "tax_rates", id, "Tax rate not found.")

  await updateTaxRatesWorkflow(req.scope).run({
    input: { selector: { id }, update: req.validatedBody },
  })

  res.json({ tax_rate: await refetchTaxRate(req, id) })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwns(req, "tax_rates", id, "Tax rate not found.")

  await deleteTaxRatesWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "tax_rate", deleted: true })
}
