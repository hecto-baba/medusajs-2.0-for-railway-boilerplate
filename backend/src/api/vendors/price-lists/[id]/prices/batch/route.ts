import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { batchPriceListPricesWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsPriceList,
  assertVendorOwnsVariants,
  refetchVendorPriceList,
} from "../../../helpers"

export const PostVendorBatchPriceListPricesSchema = z.object({
  create: z
    .array(
      z.object({
        variant_id: z.string(),
        currency_code: z.string(),
        amount: z.number(),
        min_quantity: z.number().int().nullish(),
        max_quantity: z.number().int().nullish(),
        rules: z.record(z.string(), z.string()).optional(),
      })
    )
    .optional()
    .default([]),
  update: z
    .array(
      z.object({
        id: z.string(),
        variant_id: z.string(),
        currency_code: z.string().optional(),
        amount: z.number().optional(),
        min_quantity: z.number().int().nullish(),
        max_quantity: z.number().int().nullish(),
        rules: z.record(z.string(), z.string()).optional(),
      })
    )
    .optional()
    .default([]),
  delete: z.array(z.string()).optional().default([]),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorBatchPriceListPricesSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsPriceList(req, id)

  const { create = [], update = [], delete: deleteIds = [] } = req.validatedBody

  // Validate variant ownership for created and updated prices
  const variantIds = [
    ...create.map((p) => p.variant_id),
    ...update.map((p) => p.variant_id),
  ].filter(Boolean)

  if (variantIds.length) {
    await assertVendorOwnsVariants(req, variantIds)
  }

  const workflow = batchPriceListPricesWorkflow(req.scope)
  await workflow.run({
    input: {
      data: {
        id,
        create,
        update,
        delete: deleteIds,
      },
    },
  })

  const priceList = await refetchVendorPriceList(id, req)

  res.status(200).json({ price_list: priceList })
}
