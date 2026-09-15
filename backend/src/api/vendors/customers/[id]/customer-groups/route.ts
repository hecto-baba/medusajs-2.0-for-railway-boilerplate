import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
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

  // If adding groups, ensure vendor owns those customer groups
  if (add && add.length) {
    const ownedGroupIds = await getVendorCustomerGroupIds(req)
    const unauthorized = add.filter((gid) => !ownedGroupIds.includes(gid))
    if (unauthorized.length) {
      res.status(403).json({
        message: `Cannot add customer groups outside vendor scope: ${unauthorized.join(", ")}`,
      })
      return
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
