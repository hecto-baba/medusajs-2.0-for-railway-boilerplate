import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  updateCollectionsWorkflow,
  deleteCollectionsWorkflow,
} from "@medusajs/medusa/core-flows"

export const UpdateVendorCollectionSchema = z.object({
  title: z.string().optional(),
  handle: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const collectionId = req.params.id

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "vendor.id",
      "vendor.products.id",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorProductIds = new Set<string>(
    (vendorAdmin?.vendor?.products || []).map((p: any) => p.id)
  )

  const { data: collections } = await query.graph({
    entity: "product_collection",
    fields: [
      "id",
      "title",
      "handle",
      "metadata",
      "created_at",
      "updated_at",
      "products.id",
      "products.title",
      "products.handle",
      "products.thumbnail",
      "products.status",
      "products.variants.id",
      "products.variants.title",
    ],
    filters: { id: collectionId },
  })

  if (!collections?.length) {
    res.status(404).json({ message: "Collection not found." })
    return
  }

  const collection = collections[0]
  // Scope the products list to only include this vendor's products
  const scopedProducts = (collection.products || []).filter((p: any) =>
    vendorProductIds.has(p.id)
  )

  res.json({
    collection: {
      ...collection,
      products: scopedProducts,
      products_count: scopedProducts.length,
    },
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorCollectionSchema>>,
  res: MedusaResponse
) => {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }
  const collectionId = req.params.id

  const { result } = await updateCollectionsWorkflow(req.scope).run({
    input: {
      selector: { id: collectionId },
      update: req.validatedBody,
    },
  })

  res.json({ collection: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }
  const collectionId = req.params.id

  await deleteCollectionsWorkflow(req.scope).run({
    input: { ids: [collectionId] },
  })

  res.json({ id: collectionId, object: "collection", deleted: true })
}
