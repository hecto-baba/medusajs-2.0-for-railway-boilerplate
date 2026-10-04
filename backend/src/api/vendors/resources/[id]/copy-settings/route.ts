import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  assertResourceOwned,
  getAppointmentService,
  listOwnedResourceIds,
} from "../../helpers"
import { CopySettingsToSchema, SETTING_KEYS } from "../../schemas"

/**
 * Copies this resource's booking rules (session length, step, capacity,
 * buffers, notice, horizon, hold, cancellation window) onto the chosen other
 * resources. Existing bookings are unaffected - each keeps the buffers and
 * capacity it was reserved with.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CopySettingsToSchema>>,
  res: MedusaResponse
) => {
  const source = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)

  const targets = [...new Set(req.validatedBody.to_resource_ids)].filter(
    (id) => id !== source.id
  )
  if (!targets.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Choose at least one other resource.")
  }

  // One query proves ownership of every target; any foreign id is a 404.
  const owned = new Set(await listOwnedResourceIds(req))
  if (!targets.every((id) => owned.has(id))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found.")
  }

  const settings = Object.fromEntries(
    SETTING_KEYS.map((key) => [key, (source as Record<string, unknown>)[key]])
  )

  // A single batched update, not one call per target.
  await service.updateProviders(targets.map((id) => ({ id, ...settings })))

  res.json({ updated: targets })
}
