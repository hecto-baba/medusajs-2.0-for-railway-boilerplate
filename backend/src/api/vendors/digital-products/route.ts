import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { CreateProductWorkflowInputDTO, IFileModuleService } from "@medusajs/framework/types"
import createDigitalProductWorkflow from "../../../workflows/create-digital-product"
import { CreateDigitalProductMediaInput } from "../../../workflows/create-digital-product/steps/create-digital-product-medias"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import { getVendorId } from "../shared/vendor-scope"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const fileModuleService: IFileModuleService = req.scope.resolve(Modules.FILE)

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0
  const productId = req.query.product_id as string | undefined

  // Retrieve products belonging to this vendor
  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorProductIds = (vendorAdmin?.vendor?.products || [])
    .map((p: any) => p?.id)
    .filter(Boolean)

  if (!vendorProductIds.length) {
    return res.json({
      digital_products: [],
      count: 0,
      limit,
      offset,
    })
  }

  const {
    data: allDigitalProducts,
    metadata,
  } = await query.graph({
    entity: "digital_product",
    fields: [
      "id",
      "name",
      "created_at",
      "updated_at",
      "medias.*",
      "product_variant.*",
      "product_variant.product.*",
      "product_variant.prices.*",
    ],
  })

  // Filter to digital products whose product variant belongs to this vendor
  let vendorDigitalProducts = (allDigitalProducts || []).filter((dp: any) => {
    const variant = Array.isArray(dp.product_variant)
      ? dp.product_variant[0]
      : dp.product_variant
    const pId = variant?.product_id || variant?.product?.id
    return pId && vendorProductIds.includes(pId)
  })

  if (productId) {
    vendorDigitalProducts = vendorDigitalProducts.filter((dp: any) => {
      const variant = Array.isArray(dp.product_variant)
        ? dp.product_variant[0]
        : dp.product_variant
      return variant?.product_id === productId || variant?.product?.id === productId
    })
  }

  // Populate media download and preview URLs
  const paginated = vendorDigitalProducts.slice(offset, offset + limit)
  const digitalProductsWithUrls = await Promise.all(
    paginated.map(async (dp: any) => {
      const mediasWithUrl = await Promise.all(
        (dp.medias || []).map(async (media: any) => {
          try {
            const file = await fileModuleService.retrieveFile(media.fileId)
            return { ...media, url: file?.url }
          } catch {
            return media
          }
        })
      )
      return {
        ...dp,
        medias: mediasWithUrl,
      }
    })
  )

  return res.json({
    digital_products: digitalProductsWithUrls,
    count: vendorDigitalProducts.length,
    limit,
    offset,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const vendorId = await getVendorId(req)

  const { data: [shippingProfile] } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })

  const body = req.body as any

  const { result } = await createDigitalProductWorkflow(req.scope).run({
    input: {
      digital_product: {
        name: body.name,
        medias: (body.medias || []).map((media: any) => ({
          fileId: media.file_id || media.fileId,
          mimeType: media.mime_type || media.mimeType || "application/octet-stream",
          type: media.type,
        })) as Omit<CreateDigitalProductMediaInput, "digital_product_id">[],
      },
      product: {
        ...(body.product as unknown as CreateProductWorkflowInputDTO),
        shipping_profile_id: body.product?.shipping_profile_id || shippingProfile?.id,
      },
    },
  })

  // Link the created product to the calling vendor
  try {
    const { data: [dp] } = await query.graph({
      entity: "digital_product",
      fields: ["id", "product_variant.id", "product_variant.product_id", "product_variant.product.id"],
      filters: { id: result.digital_product.id },
    })

    const variant = Array.isArray(dp?.product_variant)
      ? dp.product_variant[0]
      : dp?.product_variant
    const productId = variant?.product_id || variant?.product?.id

    if (productId && vendorId) {
      await remoteLink.create([
        {
          [MARKETPLACE_MODULE]: { vendor_id: vendorId },
          [Modules.PRODUCT]: { product_id: productId },
        },
      ])
    }
  } catch (linkErr) {
    console.error("[POST /vendors/digital-products] Error linking product to vendor:", linkErr)
  }

  return res.status(201).json({
    digital_product: result.digital_product,
  })
}
