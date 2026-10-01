import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { linkCustomerGroupsToCustomerWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsCustomer,
  getVendorCustomerGroupIds,
  refetchVendorCustomer,
} from "../../helpers"

export const PostVendorBatchCustomerGroupsSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorBatchCustomerGroupsSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { add, remove } = req.validatedBody

  // Ensure vendor owns the customer
  await assertVendorOwnsCustomer(req, id)

  // Every group named, whether added or removed, must be one of the seller's own.
  // Another seller's group answers 404 (never 403, never echoing ids).
  const namedGroupIds = [...(add ?? []), ...(remove ?? [])]
  if (namedGroupIds.length) {
    const ownedGroupIds = await getVendorCustomerGroupIds(req)
    if (namedGroupIds.some((gid) => !ownedGroupIds.includes(gid))) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer group not found.")
    }
  }

  const workflow = linkCustomerGroupsToCustomerWorkflow(req.scope)
  await workflow.run({
    input: {
      id,
      add,
      remove,
    },
  })

  const customer = await refetchVendorCustomer(id, req)

  res.status(200).json({ customer })
}
