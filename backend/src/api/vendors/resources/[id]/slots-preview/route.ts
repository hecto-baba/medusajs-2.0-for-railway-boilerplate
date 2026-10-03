import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MAX_RANGE_DAYS } from "../../../../../modules/appointment-booking/lib/availability"
import { assertResourceOwned, getAppointmentService } from "../../helpers"
import { GetSlotsPreviewSchema } from "../../schemas"

/**
 * The slots exactly as a buyer would see them right now, so the seller can
 * check their hours, holidays, buffers and rules before going live. Computed
 * live - nothing is stored.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const service = getAppointmentService(req)
  const { product_id, from, to } = req.validatedQuery as z.infer<
    typeof GetSlotsPreviewSchema
  >

  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Choose a range of at most ${MAX_RANGE_DAYS} days.`
    )
  }

  const slots = await service.listBookableSlots({
    provider_id: resource.id,
    product_id: product_id ?? null,
    from,
    to,
  })

  res.json({
    timezone: resource.timezone,
    count: slots.length,
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      capacity: s.capacity,
      capacity_remaining: s.capacity_remaining,
      spots_taken: s.capacity - s.capacity_remaining,
    })),
  })
}
