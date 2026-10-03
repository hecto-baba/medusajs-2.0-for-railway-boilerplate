import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { DIGITAL_PRODUCT_MODULE } from "../../../../modules/digital-product"
import DigitalProductModuleService from "../../../../modules/digital-product/service"
import { MediaType } from "../../../../modules/digital-product/types"
import { IFileModuleService } from "@medusajs/framework/types"

async function assertVendorOwnsDigitalProduct(
  req: AuthenticatedMedusaRequest,
  digitalProductId: string
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

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

  const {
    data: [digitalProduct],
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
    filters: { id: digitalProductId },
  })

  if (!digitalProduct) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Digital product not found.")
  }

  const variant = Array.isArray(digitalProduct.product_variant)
    ? digitalProduct.product_variant[0]
    : digitalProduct.product_variant
  const pId = variant?.product_id || variant?.product?.id

  if (!pId || !vendorProductIds.includes(pId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Digital product not found.")
  }

  return digitalProduct
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const digitalProduct = await assertVendorOwnsDigitalProduct(req, req.params.id)
  const fileModuleService: IFileModuleService = req.scope.resolve(Modules.FILE)

  const mediasWithUrl = await Promise.all(
    (digitalProduct.medias || []).map(async (media: any) => {
      try {
        const file = await fileModuleService.retrieveFile(media.fileId)
        return { ...media, url: file?.url }
      } catch {
        return media
      }
    })
  )

  return res.json({
    digital_product: {
      ...digitalProduct,
      medias: mediasWithUrl,
    },
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertVendorOwnsDigitalProduct(req, req.params.id)

  const digitalProductModuleService: DigitalProductModuleService = req.scope.resolve(
    DIGITAL_PRODUCT_MODULE
  )
  const { id } = req.params
  const { medias } = req.body as {
    medias: {
      type: MediaType
      file_id: string
      mime_type: string
    }[]
  }

  if (!medias || !medias.length) {
    return res.status(400).json({ message: "No medias provided" })
  }

  try {
    const createdMedias = await Promise.all(
      medias.map((m) =>
        (digitalProductModuleService as any).createDigitalProductMedias({
          digital_product_id: id,
          digitalProduct_id: id,
          type: m.type,
          fileId: m.file_id,
          mimeType: m.mime_type,
        })
      )
    )

    return res.json({ medias: createdMedias })
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to attach media" })
  }
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertVendorOwnsDigitalProduct(req, req.params.id)

  const digitalProductModuleService: DigitalProductModuleService = req.scope.resolve(
    DIGITAL_PRODUCT_MODULE
  )
  const { id } = req.params

  await digitalProductModuleService.deleteDigitalProducts([id])

  return res.json({
    id,
    object: "digital_product",
    deleted: true,
  })
}
