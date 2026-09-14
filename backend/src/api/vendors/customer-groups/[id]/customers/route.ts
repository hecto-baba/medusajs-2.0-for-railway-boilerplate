import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { linkCustomersToCustomerGroupWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsCustomerGroup,
  getVendorCustomerIds,
  refetchVendorCustomerGroup,
} from "../../../customers/helpers"

export const PostVendorCustomerGroupCustomersSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorCustomerGroupCustomersSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { add, remove } = req.validatedBody

  // Ensure vendor owns the group
  await assertVendorOwnsCustomerGroup(req, id)

  // If adding customers, ensure the vendor owns those customer records
  if (add && add.length) {
    const ownedCustomerIds = await getVendorCustomerIds(req)
    const unauthorized = add.filter((cid) => !ownedCustomerIds.includes(cid))
    if (unauthorized.length) {
      res.status(403).json({
        message: `Cannot add customers outside vendor scope: ${unauthorized.join(", ")}`,
      })
      return
    }
  }

  const workflow = linkCustomersToCustomerGroupWorkflow(req.scope)
  await workflow.run({
    input: {
      id,
      add,
      remove,
    },
  })

  const customerGroup = await refetchVendorCustomerGroup(id, req)

  res.status(200).json({ customer_group: customerGroup })
}
