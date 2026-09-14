import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  deleteReservationsWorkflow,
  updateReservationsWorkflow,
} from "@medusajs/medusa/core-flows"
import { getVendorInventoryItemIds } from "../../inventory-items/helpers"

export const PostVendorUpdateReservationSchema = z.object({
  location_id: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  description: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

const assertVendorOwnsReservation = async (
  req: AuthenticatedMedusaRequest,
  reservationId: string
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [reservation],
  } = await query.graph({
    entity: "reservation",
    fields: ["id", "inventory_item_id"],
    filters: { id: [reservationId] },
  })

  if (!reservation) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Reservation with id: ${reservationId} was not found.`
    )
  }

  const ownedItemIds = await getVendorInventoryItemIds(req)

  if (!ownedItemIds.includes(reservation.inventory_item_id)) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Reservation with id: ${reservationId} was not found.`
    )
  }

  return reservation
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsReservation(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [reservation],
  } = await query.graph({
    entity: "reservation",
    fields: [
      "id",
      "inventory_item_id",
      "location_id",
      "quantity",
      "description",
      "line_item_id",
      "metadata",
      "created_at",
      "updated_at",
      "inventory_item.id",
      "inventory_item.title",
      "inventory_item.sku",
    ],
    filters: { id: [id] },
  })

  res.json({ reservation })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorUpdateReservationSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsReservation(req, id)

  await updateReservationsWorkflow(req.scope).run({
    input: {
      updates: [{ id, ...req.validatedBody }],
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [reservation],
  } = await query.graph({
    entity: "reservation",
    fields: [
      "id",
      "inventory_item_id",
      "location_id",
      "quantity",
      "description",
      "line_item_id",
      "metadata",
      "created_at",
      "updated_at",
      "inventory_item.id",
      "inventory_item.title",
      "inventory_item.sku",
    ],
    filters: { id: [id] },
  })

  res.json({ reservation })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsReservation(req, id)

  await deleteReservationsWorkflow(req.scope).run({
    input: {
      ids: [id],
    },
  })

  res.json({
    id,
    object: "reservation",
    deleted: true,
  })
}
