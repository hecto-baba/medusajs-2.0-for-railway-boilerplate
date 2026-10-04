import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { DIGITAL_PRODUCT_MODULE } from "../../../../../../modules/digital-product"
import DigitalProductModuleService from "../../../../../../modules/digital-product/service"

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id: digitalProductId, media_id: mediaId } = req.params

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

  if (!pId || !vendorProductIds.includes(pId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Digital product not found.")
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
