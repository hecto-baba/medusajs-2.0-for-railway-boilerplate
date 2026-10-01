import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { InferTypeOf, OrderLineItemDTO, ProductVariantDTO } from "@medusajs/framework/types"
import { DIGITAL_PRODUCT_MODULE } from "../../../modules/digital-product"
import DigitalProductModuleService from "../../../modules/digital-product/service"
import { OrderStatus } from "../../../modules/digital-product/types"
import DigitalProduct from "../../../modules/digital-product/models/digital-product"

export type CreateDigitalProductOrderStepInput = {
  items: (OrderLineItemDTO & {
    variant: ProductVariantDTO & {
      digital_product: InferTypeOf<typeof DigitalProduct>
    }
  })[]
}

const createDigitalProductOrderStep = createStep(
  "create-digital-product-order",
  async ({ items }: CreateDigitalProductOrderStepInput, { container }) => {
    const digitalProductModuleService: DigitalProductModuleService =
      container.resolve(DIGITAL_PRODUCT_MODULE)
    
    const digitalProductIds = items
      .filter((item) => item.variant?.digital_product?.id)
      .map((item) => item.variant.digital_product.id)

    const digitalProductOrder = await digitalProductModuleService.createDigitalProductOrders({
      status: OrderStatus.PENDING,
      products: digitalProductIds,
    })

    return new StepResponse(
      {
        digital_product_order: digitalProductOrder,
      },
      {
        digital_product_order: digitalProductOrder,
      }
    )
  },
  async (data, { container }) => {
    if (!data) {
      return
    }
    const digitalProductModuleService: DigitalProductModuleService =
      container.resolve(DIGITAL_PRODUCT_MODULE)
    await digitalProductModuleService.deleteDigitalProductOrders(
      data.digital_product_order.id
    )
  }
)

export default createDigitalProductOrderStep
