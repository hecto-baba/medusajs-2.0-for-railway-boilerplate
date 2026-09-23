import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { batchProductsWorkflow } from "@medusajs/medusa/core-flows"

export const ManageCollectionProductsSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof ManageCollectionProductsSchema>>,
  res: MedusaResponse
) => {
  const collectionId = req.params.id
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

  const updates: any[] = []

  // Add products to collection
  for (const prodId of add) {
    if (vendorProductIds.has(prodId)) {
      updates.push({ id: prodId, collection_id: collectionId })
    }
  }

  // Remove products from collection
  for (const prodId of remove) {
    if (vendorProductIds.has(prodId)) {
      updates.push({ id: prodId, collection_id: null })
    }
  }

  if (updates.length > 0) {
    await batchProductsWorkflow(req.scope).run({
      input: {
        update: updates,
      },
    })
  }

  res.json({ success: true, updated: updates.length })
}
