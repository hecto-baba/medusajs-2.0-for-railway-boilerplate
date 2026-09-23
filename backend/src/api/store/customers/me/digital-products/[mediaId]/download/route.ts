import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const fileModuleService = req.scope.resolve(
    Modules.FILE
  )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [customer] } = await query.graph({
    entity: "customer",
    fields: [
      "orders.digital_product_order.*",
    ],
    filters: {
      id: req.auth_context.actor_id,
    },
  })

  const customerDigitalOrderIds = customer?.orders
    ?.filter((order: any) => order?.digital_product_order !== undefined)
    .map((order: any) => order!.digital_product_order!.id) || []

  const { data: dpoResult } = await query.graph({
    entity: "digital_product_order",
    fields: [
      "products.medias.*",
    ],
    filters: {
      id: customerDigitalOrderIds,
    },
  })

  if (!dpoResult.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Customer didn't purchase digital product."
    )
  }

  let foundMedia: any | undefined = undefined

  dpoResult.some((dpo: any) => {
    return dpo.products?.some((product: any) => {
      return product?.medias?.some((media: any) => {
        if (media?.id === req.params.mediaId) {
          foundMedia = media
          return true
        }
        return false
      })
    })
  })

  if (!foundMedia) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Customer didn't purchase digital product."
    )
  }

  let downloadUrl = ""
  try {
    const presigned = await (fileModuleService as any).getPresignedDownloadUrl({
      fileKey: foundMedia.fileId,
      isPrivate: true,
    })
    downloadUrl = typeof presigned === "string" ? presigned : presigned?.url
  } catch {}

  if (!downloadUrl) {
    const fileData = await fileModuleService.retrieveFile(foundMedia.fileId)
    downloadUrl = fileData.url
  }

  res.json({
    url: downloadUrl,
  })
}
