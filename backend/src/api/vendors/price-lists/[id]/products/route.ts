import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { batchPriceListPricesWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsPriceList,
  refetchVendorPriceList,
} from "../../helpers"

export const PostVendorRemoveProductsPriceListSchema = z.object({
  remove: z.array(z.string()).min(1, "At least one product ID is required to remove"),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorRemoveProductsPriceListSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsPriceList(req, id)

  const { remove = [] } = req.validatedBody

  // Find all price IDs associated with these product IDs in this price list
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "price_set.prices.id", "price_set.prices.price_list_id"],
    filters: { product_id: remove },
  })

  const priceIdsToDelete: string[] = []
  for (const variant of variants) {
    const prices = (variant as any).price_set?.prices ?? []
    for (const price of prices) {
      if (price.price_list_id === id) {
        priceIdsToDelete.push(price.id)
      }
    }
  }

  if (priceIdsToDelete.length) {
    const workflow = batchPriceListPricesWorkflow(req.scope)
    await workflow.run({
      input: {
        data: {
          id,
          create: [],
          update: [],
          delete: priceIdsToDelete,
        },
      },
    })
  }

  const priceList = await refetchVendorPriceList(id, req)

  res.status(200).json({ price_list: priceList })
}
