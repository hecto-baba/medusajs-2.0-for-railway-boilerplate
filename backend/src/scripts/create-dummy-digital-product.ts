import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import createDigitalProductWorkflow from "../workflows/create-digital-product"
import { MediaType } from "../modules/digital-product/types"

export default async function createDummyDigitalProduct({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("Creating dummy media files...")

  const { result: uploadedFiles } = await uploadFilesWorkflow(container).run({
    input: {
      files: [
        {
          filename: "ai-prompt-guide-preview.png",
          mimeType: "image/png",
          content: Buffer.from("DUMMY PREVIEW CONTENT FOR AI PROMPT GUIDE").toString("base64"),
          access: "public",
        },
        {
          filename: "ai-prompt-engineering-bundle.zip",
          mimeType: "application/zip",
          content: Buffer.from("DUMMY MAIN ZIP CONTENT FOR DIGITAL ASSETS BUNDLE").toString("base64"),
          access: "private",
        },
      ],
    },
  })

  const previewFile = uploadedFiles[0]
  const mainFile = uploadedFiles[1]

  logger.info(`Uploaded preview file (${previewFile.id}) and main file (${mainFile.id})`)

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
  })

  logger.info("Running createDigitalProductWorkflow...")

  const { result } = await createDigitalProductWorkflow(container).run({
    input: {
      digital_product: {
        name: "AI Prompt Engineering Guide & Assets",
        medias: [
          {
            fileId: previewFile.id,
            mimeType: "image/png",
            type: MediaType.PREVIEW,
          },
          {
            fileId: mainFile.id,
            mimeType: "application/zip",
            type: MediaType.MAIN,
          },
        ],
      },
      product: {
        title: "AI Prompt Engineering Guide & Assets",
        description: "Comprehensive guide with 500+ pre-tested AI prompts, system prompts, workflows, and downloadable automation assets.",
        status: "published" as const,
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600",
        images: [
          { url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600" }
        ],
        shipping_profile_id: shippingProfiles[0]?.id,
        sales_channels: salesChannels.map((sc: any) => ({ id: sc.id })),
        options: [
          {
            title: "Default",
            values: ["default"],
          },
        ],
        variants: [
          {
            title: "Default Variant",
            manage_inventory: false,
            options: {
              Default: "default",
            },
            prices: [
              {
                currency_code: "usd",
                amount: 2900,
              },
              {
                currency_code: "eur",
                amount: 2700,
              },
            ],
          },
        ],
      },
    },
  })

  logger.info("==================================================")
  logger.info("🎉 DUMMY DIGITAL PRODUCT CREATED SUCCESSFULLY!")
  logger.info(`Digital Product ID: ${result.digital_product.id}`)
  logger.info(`Digital Product Name: ${result.digital_product.name}`)
  logger.info("==================================================")
}
