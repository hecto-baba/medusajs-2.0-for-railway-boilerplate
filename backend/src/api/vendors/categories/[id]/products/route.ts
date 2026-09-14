import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { batchLinkProductsToCategoryWorkflow } from "@medusajs/medusa/core-flows"

export const ManageCategoryProductsSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof ManageCategoryProductsSchema>>,
  res: MedusaResponse
) => {
  const categoryId = req.params.id
  const { add = [], remove = [] } = req.validatedBody
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Verify vendor ownership of the products being added/removed
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
    await batchLinkProductsToCategoryWorkflow(req.scope).run({
      input: {
        id: categoryId,
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
