import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DIGITAL_PRODUCT_MODULE } from "../../../../modules/digital-product"
import DigitalProductModuleService from "../../../../modules/digital-product/service"
import { MediaType } from "../../../../modules/digital-product/types"
import { IFileModuleService } from "@medusajs/framework/types"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const fileModuleService: IFileModuleService = req.scope.resolve(Modules.FILE)
  const { id } = req.params

  const { data: [digitalProduct] } = await query.graph({
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
    filters: { id },
  })

  if (!digitalProduct) {
    res.status(404).json({ message: "Digital product not found" })
    return
  }

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

  res.json({
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
    res.status(400).json({ message: "No medias provided" })
    return
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

    res.json({ medias: createdMedias })
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Failed to attach media" })
  }
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const digitalProductModuleService: DigitalProductModuleService = req.scope.resolve(
    DIGITAL_PRODUCT_MODULE
  )
  const { id } = req.params

  await digitalProductModuleService.deleteDigitalProducts([id])

  res.json({
    id,
    object: "digital_product",
    deleted: true,
  })
}