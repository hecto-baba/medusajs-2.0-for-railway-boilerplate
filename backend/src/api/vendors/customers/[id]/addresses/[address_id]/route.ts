import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  deleteCustomerAddressesWorkflow,
  updateCustomerAddressesWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsCustomer,
  refetchVendorCustomer,
} from "../../../helpers"

export const PostVendorUpdateCustomerAddressSchema = z.object({
  address_name: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  address_1: z.string().optional().nullable(),
  address_2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country_code: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  is_default_shipping: z.boolean().optional(),
  is_default_billing: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id: customerId, address_id: addressId } = req.params
  await assertVendorOwnsCustomer(req, customerId)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [address],
  } = await query.graph({
    entity: "customer_address",
    fields: ["*"],
    filters: {
      id: [addressId],
      customer_id: [customerId],
    },
  })

  if (!address) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Address with id: ${addressId} not found`
    )
  }

  res.json({ address })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorUpdateCustomerAddressSchema>
  >,
  res: MedusaResponse
) => {
  const { id: customerId, address_id: addressId } = req.params
  await assertVendorOwnsCustomer(req, customerId)

  const addressData = req.validatedBody
  const updatePayload = {
    ...addressData,
    ...(addressData.country_code
      ? { country_code: addressData.country_code.toLowerCase() }
      : {}),
  }

  const updateAddresses = updateCustomerAddressesWorkflow(req.scope)
  await updateAddresses.run({
    input: {
      selector: { id: addressId, customer_id: customerId },
      update: updatePayload,
    },
  })

  const customer = await refetchVendorCustomer(customerId, req)

  res.status(200).json({ customer })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id: customerId, address_id: addressId } = req.params
  await assertVendorOwnsCustomer(req, customerId)

  const deleteAddress = deleteCustomerAddressesWorkflow(req.scope)
  await deleteAddress.run({
    input: { ids: [addressId] },
  })

  const customer = await refetchVendorCustomer(customerId, req)

  res.status(200).json({
    id: addressId,
    object: "customer_address",
    deleted: true,
    parent: customer,
  })
}
