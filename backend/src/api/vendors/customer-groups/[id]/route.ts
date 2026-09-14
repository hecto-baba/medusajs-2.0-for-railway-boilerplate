import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  deleteCustomerGroupsWorkflow,
  updateCustomerGroupsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsCustomerGroup,
  refetchVendorCustomerGroup,
} from "../../customers/helpers"

export const PostVendorUpdateCustomerGroupSchema = z.object({
  name: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsCustomerGroup(req, id)

  const customerGroup = await refetchVendorCustomerGroup(id, req)

  if (!customerGroup) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Customer group with id: ${id} not found`
    )
  }

  res.status(200).json({ customer_group: customerGroup })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorUpdateCustomerGroupSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsCustomerGroup(req, id)

  const updateData = req.validatedBody

  await updateCustomerGroupsWorkflow(req.scope).run({
    input: {
      selector: { id },
      update: updateData,
    },
  })

  const customerGroup = await refetchVendorCustomerGroup(id, req)

  res.status(200).json({ customer_group: customerGroup })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsCustomerGroup(req, id)

  const deleteCustomerGroups = deleteCustomerGroupsWorkflow(req.scope)
  await deleteCustomerGroups.run({
    input: { ids: [id] },
  })

  res.status(200).json({
    id,
    object: "customer_group",
    deleted: true,
  })
}
