import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { DIGITAL_PRODUCT_MODULE } from "../../../../../modules/digital-product"
import DigitalProductModuleService from "../../../../../modules/digital-product/service"
import { MediaType } from "../../../../../modules/digital-product/types"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const fileModuleService = req.scope.resolve(
    Modules.FILE
  )
  const digitalProductModuleService: DigitalProductModuleService =
    req.scope.resolve(
      DIGITAL_PRODUCT_MODULE
    )

  const medias = await digitalProductModuleService.listDigitalProductMedias({
    digital_product_id: req.params.id,
    type: MediaType.PREVIEW,
  })

  const normalizedMedias = (
    await Promise.all(
      medias.map(async (media) => {
        const { fileId, ...mediaData } = media
        try {
          const fileData = await fileModuleService.retrieveFile(fileId)
          return {
            ...mediaData,
            url: fileData.url,
          }
        } catch {
          if (fileId.startsWith("http://") || fileId.startsWith("https://") || fileId.startsWith("/")) {
            return {
              ...mediaData,
              url: fileId,
            }
          }
          return null
        }
      })
    )
  ).filter(Boolean)

  res.json({
    previews: normalizedMedias,
  })
}
