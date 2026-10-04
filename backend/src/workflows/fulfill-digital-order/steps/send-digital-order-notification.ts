import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { IFileModuleService } from "@medusajs/framework/types"
import {
  MedusaError,
  ModuleRegistrationName,
  promiseAll,
} from "@medusajs/framework/utils"
import { DigitalProductOrder, MediaType } from "../../../modules/digital-product/types"
import { sendNotice } from "../../../lib/email-notice"

export type SendDigitalOrderNotificationStepInput = {
  digital_product_order: DigitalProductOrder
}

export const sendDigitalOrderNotificationStep = createStep(
  "send-digital-order-notification",
  async (
    {
      digital_product_order: digitalProductOrder,
    }: SendDigitalOrderNotificationStepInput,
    { container }
  ) => {
    const fileModuleService: IFileModuleService = container.resolve(
      ModuleRegistrationName.FILE
    )

    if (!digitalProductOrder.order) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Digital product order is missing associated order."
      )
    }

    if (!digitalProductOrder.order.email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Order is missing email."
      )
    }

    const notificationData = await promiseAll(
      digitalProductOrder.products.map(async (product: any) => {
        const medias: string[] = []

        await promiseAll(
          product.medias
            .filter((media: any) => media.type === MediaType.MAIN)
            .map(async (media: any) => {
              medias.push((await fileModuleService.retrieveFile(media.fileId)).url)
            })
        )

        return {
          name: product.name,
          medias,
        }
      })
    )

    // Sent once per digital order (idempotent), and a failed send is logged, not
    // thrown: the buyer can still download from their account.
    const result = await sendNotice(container, {
      template: "digital-order-ready",
      to: digitalProductOrder.order.email,
      subject: "Your digital purchase is ready",
      resourceId: digitalProductOrder.id,
      resourceType: "digital_product_order",
      notice: {
        heading: "Your download is ready",
        paragraphs: [
          "Thank you for your purchase. Your files are below. You can also download them any time from your account.",
          ...notificationData.flatMap((product) =>
            product.medias.map((url) => `${product.name}: ${url}`)
          ),
        ],
      },
    })

    return new StepResponse(result)
  }
)
