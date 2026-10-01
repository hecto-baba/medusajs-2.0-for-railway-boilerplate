import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { productId } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: [product] } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "description",
        "thumbnail",
        "status",
        "metadata",
        "images.*",
        "options.*",
        "options.values.*",
        "variants.*",
        "variants.prices.*",
      ],
      filters: { id: productId },
    })

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    return res.status(200).json({ product })
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to fetch product" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { productId } = req.params
  const body = req.body as any
  const productModule = req.scope.resolve(Modules.PRODUCT)

  try {
    // 1. Update product main properties and metadata (dietary_type, promo_badge, addons)
    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.thumbnail !== undefined) updateData.thumbnail = body.thumbnail
    if (body.images !== undefined) updateData.images = body.images
    if (body.status !== undefined) updateData.status = body.status
    if (body.metadata !== undefined) updateData.metadata = body.metadata

    await (productModule as any).updateProducts(productId, updateData)

    // 2. Update / create variants if provided
    if (body.variants && Array.isArray(body.variants)) {
      for (const v of body.variants) {
        if (v.id) {
          await (productModule as any).updateProductVariants(v.id, {
            title: v.title,
            prices: v.prices,
          })
        } else {
          await (productModule as any).createProductVariants({
            product_id: productId,
            title: v.title,
            options: v.options || { Portion: v.title },
            prices: v.prices,
          })
        }
      }
    }

    // 3. Delete obsolete variants if requested
    if (
      body.deleted_variant_ids &&
      Array.isArray(body.deleted_variant_ids) &&
      body.deleted_variant_ids.length > 0
    ) {
      await (productModule as any).deleteProductVariants(body.deleted_variant_ids)
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: [updatedProduct] } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "description",
        "thumbnail",
        "status",
        "metadata",
        "variants.*",
        "variants.prices.*",
      ],
      filters: { id: productId },
    })

    return res.status(200).json({ product: updatedProduct })
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to update product" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { productId } = req.params
  const productModule = req.scope.resolve(Modules.PRODUCT)
  try {
    await (productModule as any).deleteProducts(productId)
    return res.status(200).json({ id: productId, deleted: true })
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to delete product" })
  }
}
