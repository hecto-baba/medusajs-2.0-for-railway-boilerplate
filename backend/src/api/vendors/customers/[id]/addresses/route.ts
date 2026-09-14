import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createCustomerAddressesWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsCustomer,
  refetchVendorCustomer,
} from "../../helpers"

export const PostVendorCreateCustomerAddressSchema = z.object({
  address_name: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  address_1: z.string().min(1, "Address line 1 is required"),
  address_2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country_code: z.string().min(2, "Country code is required (e.g. us, in)"),
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
  const customerId = req.params.id
  await assertVendorOwnsCustomer(req, customerId)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: addresses } = await query.graph({
    entity: "customer_address",
    fields: ["*"],
    filters: { customer_id: [customerId] },
  })

  res.json({
    addresses,
    count: addresses.length,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorCreateCustomerAddressSchema>
  >,
  res: MedusaResponse
) => {
  const customerId = req.params.id
  await assertVendorOwnsCustomer(req, customerId)

  const addressData = req.validatedBody

  const createAddresses = createCustomerAddressesWorkflow(req.scope)
  await createAddresses.run({
    input: {
      addresses: [
        {
          ...addressData,
          customer_id: customerId,
          country_code: addressData.country_code.toLowerCase(),
        },
      ],
    },
  })

  const customer = await refetchVendorCustomer(customerId, req)

  res.status(201).json({ customer })
}
