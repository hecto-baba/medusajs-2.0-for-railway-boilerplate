import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  deletePriceListsWorkflow,
  dismissLinksWorkflow,
  updatePriceListsWorkflow,
} from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../../modules/marketplace"
import {
  assertVendorOwnsPriceList,
  getVendorId,
  refetchVendorPriceList,
} from "../helpers"

export const PostVendorUpdatePriceListSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullish(),
  type: z.enum(["sale", "override"]).optional(),
  status: z.enum(["active", "draft"]).optional(),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
  rules: z.record(z.string(), z.array(z.string())).optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsPriceList(req, id)

  const priceList = await refetchVendorPriceList(id, req)

  if (!priceList) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Price list with id: ${id} not found`
    )
  }

  res.status(200).json({ price_list: priceList })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorUpdatePriceListSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsPriceList(req, id)

  const updateData = req.validatedBody

  await updatePriceListsWorkflow(req.scope).run({
    input: {
      price_lists_data: [
        {
          id,
          ...updateData,
          starts_at: updateData.starts_at || null,
          ends_at: updateData.ends_at || null,
        },
      ],
    },
  })

  const priceList = await refetchVendorPriceList(id, req)

  res.status(200).json({ price_list: priceList })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const vendorId = await getVendorId(req)

  await assertVendorOwnsPriceList(req, id)

  // Run core delete workflow
  await deletePriceListsWorkflow(req.scope).run({
    input: { ids: [id] },
  })

  // Dismiss link
  try {
    await dismissLinksWorkflow(req.scope).run({
      input: [
        {
          [MARKETPLACE_MODULE]: { vendor_id: vendorId },
          [Modules.PRICING]: { price_list_id: id },
        },
      ],
    })
  } catch {
    // If cascade or already dismissed
  }

  res.status(200).json({
    id,
    object: "price_list",
    deleted: true,
  })
}
