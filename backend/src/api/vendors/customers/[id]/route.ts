import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  dismissLinksWorkflow,
  updateCustomersWorkflow,
} from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../../modules/marketplace"
import {
  assertVendorOwnsCustomer,
  getVendorId,
  refetchVendorCustomer,
} from "../helpers"

export const PostVendorUpdateCustomerSchema = z.object({
  email: z.string().email("Invalid email address").optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsCustomer(req, id)

  const customer = await refetchVendorCustomer(id, req)

  if (!customer) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Customer with id: ${id} not found`
    )
  }

  res.status(200).json({ customer })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorUpdateCustomerSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsCustomer(req, id)

  const updateData = req.validatedBody

  await updateCustomersWorkflow(req.scope).run({
    input: {
      selector: { id },
      update: updateData,
    },
  })

  const customer = await refetchVendorCustomer(id, req)

  res.status(200).json({ customer })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const vendorId = await getVendorId(req)

  await assertVendorOwnsCustomer(req, id)

  // Dismiss the link between this vendor and customer
  await dismissLinksWorkflow(req.scope).run({
    input: [
      {
        [MARKETPLACE_MODULE]: { vendor_id: vendorId },
        [Modules.CUSTOMER]: { customer_id: id },
      },
    ],
  })

  res.status(200).json({
    id,
    object: "customer",
    deleted: true,
  })
}
