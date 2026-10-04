import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { DIGITAL_PRODUCT_MODULE } from "../../../../../../modules/digital-product"
import DigitalProductModuleService from "../../../../../../modules/digital-product/service"
import { assertVendorOwns } from "../../../../shared/vendor-scope"

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id: digitalProductId, media_id: mediaId } = req.params

  const {
    data: [digitalProduct],
  } = await query.graph({
    entity: "digital_product",
    fields: [
      "id",
      "medias.*",
      "product_variant.*",
      "product_variant.product.*",
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

  if (!pId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Digital product not found.")
  }
  await assertVendorOwns(req, "products", pId, "Digital product not found.")

  // The media must belong to THIS product. Without this a seller could pass their
  // own product id with another seller's media id and delete that media.
  const mediaBelongs = ((digitalProduct as any).medias ?? []).some((media: any) => media?.id === mediaId)
  if (!mediaBelongs) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Media not found.")
  }

  const digitalProductModuleService: DigitalProductModuleService = req.scope.resolve(
    DIGITAL_PRODUCT_MODULE
  )

  await (digitalProductModuleService as any).deleteDigitalProductMedias([mediaId])

  return res.json({
    id: mediaId,
    object: "digital_product_media",
    deleted: true,
  })
}
