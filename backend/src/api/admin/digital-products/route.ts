import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import createDigitalProductWorkflow from "../../../workflows/create-digital-product"
import { CreateDigitalProductMediaInput } from "../../../workflows/create-digital-product/steps/create-digital-product-medias"
import { CreateDigitalProductsSchema } from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productId = req.query.product_id as string | undefined

  const {
    data: digitalProducts,
    metadata: { count, take, skip } = {},
  } = await query.graph({
    entity: "digital_product",
    ...req.queryConfig,
  })

  const filteredProducts = productId
    ? digitalProducts.filter((dp: any) => {
        const variant = Array.isArray(dp.product_variant)
          ? dp.product_variant[0]
          : dp.product_variant
        return (
          variant?.product_id === productId ||
          variant?.product?.id === productId
        )
      })
    : digitalProducts

  res.json({
    digital_products: filteredProducts,
    count: productId ? filteredProducts.length : count,
    limit: take,
    offset: skip,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<CreateDigitalProductsSchema>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [shippingProfile] } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })

  const { result } = await createDigitalProductWorkflow(req.scope).run({
    input: {
      digital_product: {
        name: req.validatedBody.name,
        medias: req.validatedBody.medias.map((media) => ({
          fileId: media.file_id,
          mimeType: media.mime_type,
          type: media.type,
        })) as Omit<CreateDigitalProductMediaInput, "digital_product_id">[],
      },
      product: {
        ...(req.validatedBody.product as unknown as CreateProductWorkflowInputDTO),
        shipping_profile_id: shippingProfile?.id,
      },
    },
  })

  res.json({
    digital_product: result.digital_product,
  })
}
