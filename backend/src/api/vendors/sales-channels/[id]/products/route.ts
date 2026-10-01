import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { linkProductsToSalesChannelWorkflow } from "@medusajs/medusa/core-flows"
import { assertVendorCanSee, ScopedEntity } from "../../../shared/platform-scope"

const SALES_CHANNELS: ScopedEntity = {
  linkField: "sales_channels",
  entity: "sales_channel",
}

export const ManageSalesChannelProductsSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof ManageSalesChannelProductsSchema>>,
  res: MedusaResponse
) => {
  const channelId = req.params.id
  const { add = [], remove = [] } = req.validatedBody

  // The seller may place their own products in their own channel or a shared
  // platform channel, never in another seller's.
  await assertVendorCanSee(req, SALES_CHANNELS, channelId, "Sales channel not found.")
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorProductIds = new Set<string>(
    (vendorAdmin?.vendor?.products || []).map((p: any) => p.id)
  )

  const validatedAdd = add.filter((id) => vendorProductIds.has(id))
  const validatedRemove = remove.filter((id) => vendorProductIds.has(id))

  if (validatedAdd.length > 0 || validatedRemove.length > 0) {
    await linkProductsToSalesChannelWorkflow(req.scope).run({
      input: {
        id: channelId,
        add: validatedAdd,
        remove: validatedRemove,
      },
    })
  }

  res.json({
    success: true,
    added: validatedAdd.length,
    removed: validatedRemove.length,
  })
}
